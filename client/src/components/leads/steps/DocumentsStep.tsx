import * as React from 'react';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { DOCUMENT_TYPES, MAX_OTHER_DOCUMENTS } from '@/types';
import type { DocumentType, LeadDocument } from '@/types';
import { DocumentUploader } from '@/components/leads/DocumentUploader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StepActions } from './StepActions';
import { REQUIRED_DOCUMENT_TYPES } from '@/schemas/lead.schema';
import * as documentService from '@/services/document.service';
import { getErrorMessage } from '@/lib/axios';

const OTHER: DocumentType = 'Other Document';

/** Editable name for an Other Document. Saved on blur once the document exists. */
function OtherDocumentName({
  value,
  onChange,
  onCommit,
  onRemoveDraft,
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit?: () => void;
  onRemoveDraft?: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        maxLength={80}
        placeholder="Document name, e.g. Ration Card"
        aria-label="Other document name"
        className="h-10 font-bold"
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
      {onRemoveDraft && (
        <Button type="button" size="icon" variant="ghost" className="h-9 w-9 flex-shrink-0" onClick={onRemoveDraft} aria-label="Cancel this document">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

/** An Other Document that has already been uploaded; its name can still be changed. */
function SavedOtherDocument({
  leadId,
  document,
  onUploaded,
  onDeleted,
}: {
  leadId: string;
  document: LeadDocument;
  onUploaded: (doc: LeadDocument) => void;
  onDeleted: () => void;
}) {
  const [name, setName] = React.useState(document.customName ?? '');

  const commit = async () => {
    const trimmed = name.trim();
    if (trimmed === (document.customName ?? '')) return;
    if (!trimmed) {
      setName(document.customName ?? '');
      toast.error('Document name cannot be empty.');
      return;
    }
    try {
      onUploaded(await documentService.renameDocument(document._id, trimmed));
      toast.success('Document renamed.');
    } catch (err) {
      setName(document.customName ?? '');
      toast.error(getErrorMessage(err, 'Unable to rename this document.'));
    }
  };

  return (
    <DocumentUploader
      leadId={leadId}
      documentType={OTHER}
      existingDocument={document}
      title={<OtherDocumentName value={name} onChange={setName} onCommit={commit} />}
      onUploaded={onUploaded}
      onDeleted={onDeleted}
    />
  );
}

/** A new Other Document card: the agent names it, then uploads. */
function DraftOtherDocument({
  leadId,
  onUploaded,
  onCancel,
}: {
  leadId: string;
  onUploaded: (doc: LeadDocument) => void;
  onCancel: () => void;
}) {
  const [name, setName] = React.useState('');
  return (
    <DocumentUploader
      leadId={leadId}
      documentType={OTHER}
      customName={name}
      uploadDisabledReason={name.trim() ? undefined : 'Enter a name for this document first.'}
      title={<OtherDocumentName value={name} onChange={setName} onRemoveDraft={onCancel} />}
      onUploaded={onUploaded}
    />
  );
}

export function DocumentsStep({
  leadId,
  documents,
  onDocumentsChange,
  onNext,
  onBack,
}: {
  leadId: string;
  documents: LeadDocument[];
  onDocumentsChange: (documents: LeadDocument[]) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const otherDocuments = documents.filter((d) => d.documentType === OTHER);
  // Unsaved Other Document cards, identified by a local key until their first upload.
  const [draftKeys, setDraftKeys] = React.useState<number[]>(() => (otherDocuments.length === 0 ? [0] : []));
  const nextDraftKey = React.useRef(1);

  const findDoc = (type: DocumentType) => documents.find((d) => d.documentType === type);

  const upsert = (doc: LeadDocument) => {
    const exists = documents.some((d) => d._id === doc._id);
    onDocumentsChange(exists ? documents.map((d) => (d._id === doc._id ? doc : d)) : [...documents, doc]);
  };

  const remove = (documentId: string) => {
    onDocumentsChange(documents.filter((d) => d._id !== documentId));
  };

  const removeDraft = (key: number) => setDraftKeys((keys) => keys.filter((k) => k !== key));

  const canAddOther = otherDocuments.length + draftKeys.length < MAX_OTHER_DOCUMENTS;

  return (
    <div className="space-y-4 p-4">
      <p className="text-sm text-muted-foreground">
        Take a photo or upload a file for each document. Photos are automatically optimized before upload.
      </p>

      {DOCUMENT_TYPES.filter((type) => type !== OTHER).map((type) => {
        const existing = findDoc(type);
        return (
          <DocumentUploader
            key={type}
            leadId={leadId}
            documentType={type}
            existingDocument={existing}
            required={(REQUIRED_DOCUMENT_TYPES as readonly string[]).includes(type)}
            onUploaded={upsert}
            onDeleted={() => existing && remove(existing._id)}
          />
        );
      })}

      <div className="space-y-3 pt-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Other Documents ({otherDocuments.length}/{MAX_OTHER_DOCUMENTS})
        </p>

        {otherDocuments.map((doc) => (
          <SavedOtherDocument key={doc._id} leadId={leadId} document={doc} onUploaded={upsert} onDeleted={() => remove(doc._id)} />
        ))}

        {draftKeys.map((key) => (
          <DraftOtherDocument
            key={`draft-${key}`}
            leadId={leadId}
            onUploaded={(doc) => {
              removeDraft(key);
              upsert(doc);
            }}
            onCancel={() => removeDraft(key)}
          />
        ))}

        {canAddOther && (
          <Button
            type="button"
            variant="outline"
            className="w-full border-dashed"
            onClick={() => setDraftKeys((keys) => [...keys, nextDraftKey.current++])}
          >
            <Plus className="h-4 w-4" /> Add Other Document
          </Button>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); onNext(); }}>
        <StepActions onBack={onBack} saving={false} />
      </form>
    </div>
  );
}
