import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Archive, ArchiveRestore } from 'lucide-react';
import { LeadDetailView } from '@/components/leads/LeadDetailView';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import * as leadService from '@/services/lead.service';
import { getErrorMessage } from '@/lib/axios';
import type { Lead, LeadStatus } from '@/types';
import { LEAD_STATUSES } from '@/types';

export function AdminLeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = React.useState<Lead | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [updatingStatus, setUpdatingStatus] = React.useState(false);

  const load = React.useCallback(() => {
    if (!id) return;
    leadService
      .getLead(id)
      .then(setLead)
      .catch((err) => {
        toast.error(getErrorMessage(err, 'Unable to load this registration.'));
        navigate('/admin/leads');
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async (status: string) => {
    if (!lead) return;
    setUpdatingStatus(true);
    try {
      const updated = await leadService.updateLeadStatus(lead._id, status);
      setLead(updated);
      toast.success(`Status updated to ${status}.`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to update status.'));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleArchiveToggle = async () => {
    if (!lead) return;
    try {
      const updated = lead.archived ? await leadService.restoreLead(lead._id) : await leadService.archiveLead(lead._id);
      setLead(updated);
      toast.success(updated.archived ? 'Registration archived.' : 'Registration restored.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!lead) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <button
        onClick={() => navigate('/admin/leads')}
        className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Registrations
      </button>

      <LeadDetailView
        lead={lead}
        canDownloadDocuments
        headerActions={
          <div className="flex items-center gap-2">
            <Select value={lead.status} onValueChange={handleStatusChange} disabled={updatingStatus}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STATUSES.map((s: LeadStatus) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleArchiveToggle}>
              {lead.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              {lead.archived ? 'Restore' : 'Archive'}
            </Button>
          </div>
        }
      />
    </div>
  );
}
