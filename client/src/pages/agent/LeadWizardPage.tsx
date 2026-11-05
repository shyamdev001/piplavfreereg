import * as React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { WizardStepIndicator, type WizardStepMeta } from '@/components/leads/WizardStepIndicator';
import { DuplicateWarningDialog } from '@/components/leads/DuplicateWarningDialog';
import { BasicDetailsStep } from '@/components/leads/steps/BasicDetailsStep';
import { AddressStep } from '@/components/leads/steps/AddressStep';
import { SolarInfoStep } from '@/components/leads/steps/SolarInfoStep';
import { ElectricityStep } from '@/components/leads/steps/ElectricityStep';
import { DocumentsStep } from '@/components/leads/steps/DocumentsStep';
import { NotesStep } from '@/components/leads/steps/NotesStep';
import { ReviewStep } from '@/components/leads/steps/ReviewStep';
import * as leadService from '@/services/lead.service';
import { getCachedDraft, setCachedDraft, clearCachedDraft } from '@/hooks/useLeadDraftCache';
import { getErrorMessage } from '@/lib/axios';
import type { Lead, LeadDocument } from '@/types';
import type { DuplicateMatch } from '@/services/lead.service';

const STEPS: WizardStepMeta[] = [
  { key: 'basic', label: 'Basic Details' },
  { key: 'address', label: 'Address' },
  { key: 'solar', label: 'System Size' },
  { key: 'electricity', label: 'Electricity Details' },
  { key: 'documents', label: 'Documents' },
  { key: 'notes', label: 'Notes' },
  { key: 'review', label: 'Review & Submit' },
];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
};

export function LeadWizardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // The same wizard serves agents (/agent/leads/...) and admins (/admin/leads/:id/edit).
  const isAdminEdit = useLocation().pathname.startsWith('/admin/');
  const listPath = isAdminEdit ? '/admin/leads' : '/agent/leads';

  const [lead, setLead] = React.useState<Lead | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [direction, setDirection] = React.useState(1);
  const [saving, setSaving] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [duplicates, setDuplicates] = React.useState<DuplicateMatch[] | null>(null);

  const completedIndexes = React.useRef(new Set<number>()).current;

  React.useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      try {
        if (id) {
          const loaded = await leadService.getLead(id);
          if (!cancelled) setLead(loaded);
        } else {
          const created = await leadService.createDraftLead({});
          if (!cancelled) {
            setLead(created);
            navigate(`/agent/leads/${created._id}/edit`, { replace: true });
          }
        }
      } catch (err) {
        const cached = id ? getCachedDraft(id) : null;
        if (cached) {
          toast.warning('Loaded your locally saved draft. Reconnect to sync with the server.');
          setLead(cached as Lead);
        } else {
          toast.error(getErrorMessage(err, 'Unable to load this registration.'));
          navigate(listPath);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const saveSection = async (section: string, data: unknown) => {
    if (!lead) return;
    setSaving(true);
    try {
      const updated = await leadService.updateLead(lead._id, { [section]: data });
      setLead(updated);
      setCachedDraft(updated._id, updated);
      return updated;
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save this step. Please check your connection and try again.'));
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const goToStep = (idx: number) => {
    setDirection(idx > stepIndex ? 1 : -1);
    completedIndexes.add(stepIndex);
    setStepIndex(idx);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBasicNext = async (data: any) => {
    try {
      await saveSection('customerBasicDetails', data);
    } catch {
      return;
    }
    try {
      const { hasDuplicates, duplicates: matches } = await leadService.checkDuplicateLead(data.mobileNumber);
      const filtered = matches.filter((m) => m._id !== lead?._id);
      if (hasDuplicates && filtered.length > 0) {
        setDuplicates(filtered);
        return;
      }
    } catch {
      // duplicate check is a convenience, non-blocking if it fails
    }
    goToStep(1);
  };

  const handleDocumentsChange = (documents: LeadDocument[]) => {
    if (!lead) return;
    const updated = { ...lead, documents };
    setLead(updated);
    setCachedDraft(updated._id, updated);
  };

  // Already submitted registrations are being edited: finishing the wizard saves, it doesn't "submit" again.
  const isEditingSubmitted = Boolean(lead && !lead.isDraft);
  const exitPath = lead && (isAdminEdit || isEditingSubmitted) ? `${listPath}/${lead._id}` : listPath;

  const handleSubmit = async () => {
    if (!lead) return;
    setSubmitting(true);
    try {
      await leadService.submitLead(lead._id);
      clearCachedDraft(lead._id);
      if (isEditingSubmitted) {
        toast.success(`Changes to ${lead.leadId} saved.`);
        navigate(exitPath);
        return;
      }
      toast.success(`Registration ${lead.leadId} submitted successfully.`);
      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.65 },
        colors: ['#d2691e', '#efa02a', '#4f9a00', '#0080d0'],
        disableForReducedMotion: true,
      });
      setTimeout(() => navigate(exitPath), 900);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Some required information is missing. Please review and try again.'));
      setSubmitting(false);
    }
  };

  if (loading || !lead) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(exitPath)}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <p className="font-mono-brand text-sm font-bold tracking-tight text-foreground">{lead.leadId}</p>
            <p className="text-[0.7rem] text-muted-foreground">
              {isEditingSubmitted ? 'Editing registration' : 'Piplav solar registration'}
            </p>
          </div>
        </div>
        <span
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-bold transition-colors ${
            saving ? 'bg-accent/20 text-accent-foreground' : 'bg-success/10 text-success'
          }`}
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {saving ? 'Saving' : 'Saved'}
        </span>
      </div>

      <WizardStepIndicator steps={STEPS} currentIndex={stepIndex} completedIndexes={completedIndexes} />

      <div className="relative mx-auto w-full max-w-xl flex-1 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={stepIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {stepIndex === 0 && (
              <BasicDetailsStep defaultValues={lead.customerBasicDetails} onNext={handleBasicNext} saving={saving} />
            )}
            {stepIndex === 1 && (
              <AddressStep
                defaultValues={lead.customerAddress}
                onBack={() => goToStep(0)}
                saving={saving}
                onNext={async (data) => {
                  try {
                    await saveSection('customerAddress', data);
                    goToStep(2);
                  } catch {
                    /* toast already shown */
                  }
                }}
              />
            )}
            {stepIndex === 2 && (
              <SolarInfoStep
                defaultValues={lead.solarInformation}
                onBack={() => goToStep(1)}
                saving={saving}
                onNext={async (data) => {
                  try {
                    await saveSection('solarInformation', data);
                    goToStep(3);
                  } catch {
                    /* toast already shown */
                  }
                }}
              />
            )}
            {stepIndex === 3 && (
              <ElectricityStep
                defaultValues={lead.electricityDetails}
                onBack={() => goToStep(2)}
                saving={saving}
                onNext={async (data) => {
                  try {
                    await saveSection('electricityDetails', data);
                    goToStep(4);
                  } catch {
                    /* toast already shown */
                  }
                }}
              />
            )}
            {stepIndex === 4 && (
              <DocumentsStep
                leadId={lead._id}
                documents={lead.documents}
                onDocumentsChange={handleDocumentsChange}
                onBack={() => goToStep(3)}
                onNext={() => goToStep(5)}
              />
            )}
            {stepIndex === 5 && (
              <NotesStep
                defaultValue={lead.notes}
                onBack={() => goToStep(4)}
                saving={saving}
                onNext={async (data) => {
                  try {
                    await saveSection('notes', data.notes);
                    goToStep(6);
                  } catch {
                    /* toast already shown */
                  }
                }}
              />
            )}
            {stepIndex === 6 && (
              <ReviewStep
                lead={lead}
                onEditStep={goToStep}
                onBack={() => goToStep(5)}
                onSubmit={handleSubmit}
                submitting={submitting}
                submitLabel={isEditingSubmitted ? 'Save Changes' : 'Submit Registration'}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <DuplicateWarningDialog
        open={Boolean(duplicates)}
        duplicates={duplicates ?? []}
        onOpenChange={(open) => !open && setDuplicates(null)}
        onCreateAnyway={() => {
          setDuplicates(null);
          goToStep(1);
        }}
      />
    </div>
  );
}
