import { CheckCircle2, Circle, Pencil, AlertTriangle, MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Lead } from '@/types';
import { REQUIRED_DOCUMENT_TYPES } from '@/schemas/lead.schema';
import { initials } from '@/lib/utils';

function SectionRow({ label, complete, onEdit, detail }: { label: string; complete: boolean; onEdit: () => void; detail?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/70 py-3.5 last:border-0">
      <div className="flex items-center gap-2.5">
        {complete ? (
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-success" />
        ) : (
          <Circle className="h-5 w-5 flex-shrink-0 text-muted-foreground/40" />
        )}
        <div>
          <p className="text-sm font-bold text-foreground">{label}</p>
          <p className={complete ? 'text-xs font-medium text-success' : 'text-xs text-muted-foreground'}>
            {detail ?? (complete ? 'Complete' : 'Incomplete')}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ReviewStep({
  lead,
  onEditStep,
  onBack,
  onSubmit,
  submitting,
}: {
  lead: Lead;
  onEditStep: (stepIndex: number) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const basicComplete = Boolean(lead.customerBasicDetails?.fullName && lead.customerBasicDetails?.mobileNumber && lead.customerBasicDetails?.customerType);
  const addressComplete = Boolean(
    lead.customerAddress?.fullAddress && lead.customerAddress?.cityVillage && lead.customerAddress?.district && lead.customerAddress?.state && lead.customerAddress?.pincode,
  );
  const solarComplete = Boolean(lead.solarInformation?.requiredSystemSizeKw);
  const electricityComplete = Boolean(lead.electricityDetails?.consumerName && lead.electricityDetails?.consumerNumber);
  const requiredDocsUploaded = REQUIRED_DOCUMENT_TYPES.filter((type) => lead.documents.some((d) => d.documentType === type)).length;
  const notesComplete = Boolean(lead.notes && lead.notes.trim().length > 0);

  const canSubmit = basicComplete && addressComplete && electricityComplete;

  return (
    <div className="space-y-5 p-4">
      <Card className="overflow-hidden">
        <div className="bg-sunrise-deep p-5 text-primary-foreground">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-base font-extrabold backdrop-blur-sm">
              {initials(lead.customerBasicDetails?.fullName || '?')}
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-extrabold leading-tight">{lead.customerBasicDetails?.fullName || 'Unnamed customer'}</p>
              <p className="flex items-center gap-1 text-sm font-medium text-primary-foreground/85">
                <Phone className="h-3.5 w-3.5" /> {lead.customerBasicDetails?.mobileNumber || '-'}
                {lead.customerBasicDetails?.customerType && (
                  <span className="ml-1.5 rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
                    {lead.customerBasicDetails.customerType}
                  </span>
                )}
              </p>
            </div>
          </div>
          {lead.customerAddress?.fullAddress && (
            <p className="mt-3 flex items-start gap-1.5 text-sm text-primary-foreground/85">
              <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              {lead.customerAddress.fullAddress}, {lead.customerAddress.cityVillage}, {lead.customerAddress.state} - {lead.customerAddress.pincode}
            </p>
          )}
          {Boolean(lead.solarInformation?.requiredSystemSizeKw) && (
            <p className="mt-1.5 text-sm text-primary-foreground/85">
              System size: <span className="font-bold">{lead.solarInformation.requiredSystemSizeKw} kW</span>
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardContent className="p-4">
          <SectionRow label="Customer Details" complete={basicComplete} onEdit={() => onEditStep(0)} />
          <SectionRow label="Address" complete={addressComplete} onEdit={() => onEditStep(1)} />
          <SectionRow label="System Size" complete={solarComplete} onEdit={() => onEditStep(2)} />
          <SectionRow label="Electricity Details" complete={electricityComplete} onEdit={() => onEditStep(3)} />
          <SectionRow
            label="Documents"
            complete={requiredDocsUploaded === REQUIRED_DOCUMENT_TYPES.length}
            detail={`${requiredDocsUploaded}/${REQUIRED_DOCUMENT_TYPES.length} required · ${lead.documents.length} total`}
            onEdit={() => onEditStep(4)}
          />
          <SectionRow label="Notes" complete={notesComplete} onEdit={() => onEditStep(5)} />
        </CardContent>
      </Card>

      {!canSubmit && (
        <div className="flex items-start gap-2.5 rounded-xl bg-warning/15 p-3.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning-foreground" />
          <p className="text-xs font-semibold text-warning-foreground">
            Customer Details, Address and Electricity Details must be complete before you can submit this registration.
          </p>
        </div>
      )}

      <div
        className="sticky bottom-0 -mx-4 flex gap-3 border-t border-border/70 bg-card/95 px-4 pt-4 backdrop-blur-sm"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <Button type="button" variant="outline" size="lg" className="flex-1" onClick={onBack} disabled={submitting}>
          Back
        </Button>
        <Button type="button" size="lg" className="flex-1" onClick={onSubmit} loading={submitting} disabled={!canSubmit}>
          {!submitting && 'Submit Registration'}
        </Button>
      </div>
    </div>
  );
}
