import * as React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserPlus, Ban, CheckCircle2, KeyRound, ArrowRight, Users, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import * as agentService from '@/services/agent.service';
import { getErrorMessage } from '@/lib/axios';
import { cn, formatDate, initials } from '@/lib/utils';
import type { Agent } from '@/types';

const passwordRules = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Z]/, 'Needs an uppercase letter')
  .regex(/[0-9]/, 'Needs a number');

const createAgentSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  email: z.string().trim().email('Enter a valid email'),
  phone: z.string().trim().regex(/^[0-9]{10}$/, 'Enter a valid 10-digit phone number'),
  password: passwordRules,
  role: z.enum(['AGENT', 'VIEWER', 'QUOTATION']),
});
type CreateAgentForm = z.infer<typeof createAgentSchema>;

const resetPasswordSchema = z.object({
  newPassword: passwordRules,
});
type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

const ROLE_LABEL: Record<Agent['role'], string> = { AGENT: 'Agent', VIEWER: 'Viewer', QUOTATION: 'Quotation' };

export function AgentsPage() {
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [addOpen, setAddOpen] = React.useState(false);
  const [showCreatePassword, setShowCreatePassword] = React.useState(false);
  const [resetTarget, setResetTarget] = React.useState<Agent | null>(null);
  const [showResetPassword, setShowResetPassword] = React.useState(false);

  const fieldAgentCount = agents.filter((a) => a.role === 'AGENT').length;
  const otherCount = agents.length - fieldAgentCount;

  const load = React.useCallback(() => {
    setLoading(true);
    agentService
      .listAgents()
      .then(setAgents)
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const {
    register: registerCreate,
    handleSubmit: handleCreateSubmit,
    reset: resetCreateForm,
    formState: { errors: createErrors, isSubmitting: isCreating },
  } = useForm<CreateAgentForm>({ resolver: zodResolver(createAgentSchema), defaultValues: { role: 'AGENT' } });

  const {
    register: registerReset,
    handleSubmit: handleResetSubmit,
    reset: resetResetForm,
    formState: { errors: resetErrors, isSubmitting: isResetting },
  } = useForm<ResetPasswordForm>({ resolver: zodResolver(resetPasswordSchema) });

  const onCreate = async (values: CreateAgentForm) => {
    try {
      const { agent } = await agentService.createAgent(values);
      toast.success(`${ROLE_LABEL[agent.role]} ${agent.name} created.`);
      setAddOpen(false);
      resetCreateForm();
      setShowCreatePassword(false);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to create account.'));
    }
  };

  const toggleStatus = async (agent: Agent) => {
    try {
      await agentService.updateAgentStatus(agent.id, agent.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE');
      toast.success(agent.status === 'ACTIVE' ? `${agent.name} disabled.` : `${agent.name} enabled.`);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const onResetPassword = async (values: ResetPasswordForm) => {
    if (!resetTarget) return;
    try {
      await agentService.resetAgentCredentials(resetTarget.id, values.newPassword);
      toast.success(`Password updated for ${resetTarget.name}.`);
      setResetTarget(null);
      resetResetForm();
      setShowResetPassword(false);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to reset password.'));
    }
  };

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[1.75rem] font-extrabold tracking-tight text-foreground">Team</h1>
          <p className="text-sm text-muted-foreground">
            {fieldAgentCount} field agent{fieldAgentCount === 1 ? '' : 's'} · {otherCount} other account
            {otherCount === 1 ? '' : 's'}
          </p>
        </div>
        <Dialog
          open={addOpen}
          onOpenChange={(open) => {
            setAddOpen(open);
            if (!open) {
              resetCreateForm();
              setShowCreatePassword(false);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4" /> Add Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
              <DialogDescription>Set the password they'll use to log in.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateSubmit(onCreate)} className="space-y-4">
              <FormField label="Account type" htmlFor="role" required>
                <div id="role" className="grid gap-2 sm:grid-cols-3">
                  {(
                    [
                      { value: 'AGENT', title: 'Field Agent', hint: 'Adds and edits registrations' },
                      { value: 'VIEWER', title: 'Viewer', hint: 'Sees everything, downloads documents, edits nothing' },
                      { value: 'QUOTATION', title: 'Quotation', hint: 'Only makes customer quotations' },
                    ] as const
                  ).map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer flex-col gap-0.5 rounded-xl border border-border/70 p-3 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                    >
                      <span className="flex items-center gap-2 font-bold">
                        <input type="radio" value={option.value} className="accent-[hsl(var(--primary))]" {...registerCreate('role')} />
                        {option.title}
                      </span>
                      <span className="text-xs text-muted-foreground">{option.hint}</span>
                    </label>
                  ))}
                </div>
              </FormField>
              <FormField label="Name" htmlFor="name" required error={createErrors.name?.message}>
                <Input id="name" {...registerCreate('name')} />
              </FormField>
              <FormField label="Email" htmlFor="email" required error={createErrors.email?.message}>
                <Input id="email" type="email" {...registerCreate('email')} />
              </FormField>
              <FormField label="Phone" htmlFor="phone" required error={createErrors.phone?.message}>
                <Input id="phone" inputMode="numeric" maxLength={10} {...registerCreate('phone')} />
              </FormField>
              <FormField
                label="Password"
                htmlFor="password"
                required
                error={createErrors.password?.message}
                hint="At least 8 characters, one uppercase letter, one number."
              >
                <div className="relative">
                  <Input
                    id="password"
                    type={showCreatePassword ? 'text' : 'password'}
                    className="pr-12"
                    autoComplete="new-password"
                    {...registerCreate('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword((v) => !v)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showCreatePassword ? 'Hide password' : 'Show password'}
                  >
                    {showCreatePassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </FormField>
              <DialogFooter>
                <Button type="submit" loading={isCreating}>
                  Create Account
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No team members yet"
          description="Add a field agent to start collecting registrations, or a viewer to share read-only access."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.id} className="overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-warm-md">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/12 text-sm font-extrabold text-primary">
                      {initials(agent.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{agent.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{agent.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1">
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide',
                        agent.status === 'ACTIVE' ? 'bg-success/12 text-success' : 'bg-destructive/12 text-destructive',
                      )}
                    >
                      {agent.status}
                    </span>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
                      {ROLE_LABEL[agent.role]}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                  <span>{agent.phone}</span>
                  <span className="h-1 w-1 rounded-full bg-border" />
                  <span>Joined {formatDate(agent.createdAt)}</span>
                </div>

                {agent.role !== 'AGENT' ? (
                  <p className="rounded-xl bg-secondary/60 px-3.5 py-2.5 text-sm font-medium text-muted-foreground">
                    {agent.role === 'VIEWER' ? 'Read-only access to all registrations' : 'Makes customer quotations'}
                  </p>
                ) : (
                <Link
                  to={`/admin/leads?agentId=${agent.id}`}
                  className="flex items-center justify-between rounded-xl bg-primary/[0.06] px-3.5 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary/10"
                >
                  <span className="font-mono-brand tabular-nums">
                    {agent.totalLeads} registration{agent.totalLeads === 1 ? '' : 's'} collected
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                )}

                <div className="flex flex-wrap gap-2 border-t border-border/70 pt-3.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setResetTarget(agent);
                      resetResetForm();
                      setShowResetPassword(false);
                    }}
                  >
                    <KeyRound className="h-3.5 w-3.5" /> Set Password
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleStatus(agent)}>
                    {agent.status === 'ACTIVE' ? (
                      <>
                        <Ban className="h-3.5 w-3.5" /> Disable
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Enable
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(resetTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setResetTarget(null);
            resetResetForm();
            setShowResetPassword(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Password</DialogTitle>
            <DialogDescription>Choose a new password for {resetTarget?.name}. They'll use it the next time they log in.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetSubmit(onResetPassword)} className="space-y-4">
            <FormField
              label="New Password"
              htmlFor="newPassword"
              required
              error={resetErrors.newPassword?.message}
              hint="At least 8 characters, one uppercase letter, one number."
            >
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showResetPassword ? 'text' : 'password'}
                  className="pr-12"
                  autoComplete="new-password"
                  {...registerReset('newPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword((v) => !v)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showResetPassword ? 'Hide password' : 'Show password'}
                >
                  {showResetPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
            </FormField>
            <DialogFooter>
              <Button type="submit" loading={isResetting}>
                Save Password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
