import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LeadDetailView } from '@/components/leads/LeadDetailView';
import * as leadService from '@/services/lead.service';
import { getErrorMessage } from '@/lib/axios';
import { toast } from 'sonner';
import type { Lead } from '@/types';

export function AgentLeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = React.useState<Lead | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!id) return;
    leadService
      .getLead(id)
      .then(setLead)
      .catch((err) => {
        toast.error(getErrorMessage(err, 'Unable to load this registration.'));
        navigate('/agent/leads');
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!lead) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <button
        onClick={() => navigate('/agent/leads')}
        className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to My Registrations
      </button>
      <LeadDetailView
        lead={lead}
        canDownloadDocuments={false}
        headerActions={
          <Button variant="outline" onClick={() => navigate(`/agent/leads/${lead._id}/edit`)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        }
      />
    </div>
  );
}
