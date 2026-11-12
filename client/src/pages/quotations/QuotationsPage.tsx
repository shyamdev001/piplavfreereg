import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Download, Eye, FileText, History, Pencil, Search, Trash2, ChevronLeft, ChevronRight, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { getErrorMessage } from '@/lib/axios';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import * as quotationService from '@/services/quotation.service';
import {
  QUOTATION_CATEGORY_LABEL,
  QUOTATION_CATEGORY_OPTIONS,
  QUOTATION_VILLAGE_LABEL,
  type Quotation,
  type QuotationExtra,
  type QuotationVillage,
} from '@/services/quotation.service';
import type { PaginationMeta } from '@/types';
import { AddOnsManager } from './AddOnsManager';
import { StaffQuotationCard } from './StaffQuotationCard';
import { EditQuotationDialog } from './EditQuotationDialog';
import * as agentService from '@/services/agent.service';
import type { Agent } from '@/types';

// The PDF prints Latin text only, so Gujarati/Hindi typing is caught here first.
const englishOnly = /^[\x20-\x7E\r\n]*$/;

const quotationSchema = z.object({
  customerName: z.string().trim().min(2, 'Name is required').regex(englishOnly, 'Please type the name in English'),
  address: z.string().trim().min(2, 'Address is required').regex(englishOnly, 'Please type the address in English'),
  mobileNumber: z.string().trim().regex(/^[0-9]{10}$/, 'Enter a valid 10-digit mobile number'),
  village: z.enum(['PIPLAV', 'OTHER']),
  category: z.enum(['GENERAL', 'SC_ST', 'PASHUPALAK']),
});
type QuotationForm = z.infer<typeof quotationSchema>;

function NewQuotationCard({ extras, onCreated }: { extras: QuotationExtra[]; onCreated: () => void }) {
  /** Ticked add-ons -> amount typed for this customer (starts at the add-on's default). */
  const [picked, setPicked] = React.useState<Record<string, string>>({});
  const offered = React.useMemo(() => extras.filter((e) => e.active), [extras]);

  // Drop ticks for add-ons the admin has just removed or switched off.
  React.useEffect(() => {
    setPicked((current) => Object.fromEntries(Object.entries(current).filter(([id]) => offered.some((e) => e._id === id))));
  }, [offered]);

  const toggleExtra = (extra: QuotationExtra) =>
    setPicked((current) => {
      const next = { ...current };
      if (extra._id in next) delete next[extra._id];
      else next[extra._id] = extra.price > 0 ? String(extra.price) : '';
      return next;
    });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<QuotationForm>({
    resolver: zodResolver(quotationSchema),
    defaultValues: { village: 'PIPLAV', category: 'GENERAL' },
  });
  const village = watch('village');
  const category = watch('category');
  const categoryOptions = QUOTATION_CATEGORY_OPTIONS[village];
  const basePrice = categoryOptions.find((o) => o.value === category)?.amount ?? 0;
  const ticked = offered
    .filter((e) => e._id in picked)
    .map((e) => ({ ...e, amount: Number(picked[e._id] || 0) }));
  // Ticked add-ons are added on top of the panels + inverter price.
  const systemPrice = basePrice;
  const amount = basePrice + ticked.reduce((sum, e) => sum + e.amount, 0);

  // Each village has its own categories; fall back to General when the old choice isn't offered.
  React.useEffect(() => {
    if (!categoryOptions.some((o) => o.value === category)) setValue('category', 'GENERAL');
  }, [categoryOptions, category, setValue]);

  const onSubmit = async (values: QuotationForm) => {
    const missing = ticked.find((e) => e.amount <= 0);
    if (missing) {
      toast.error(`Enter the ${missing.name} amount.`);
      return;
    }
    try {
      const quotation = await quotationService.createQuotation({
        ...values,
        extras: ticked.map((e) => ({ id: e._id, price: e.amount })),
      });
      quotationService.downloadQuotationPdf(quotation._id);
      toast.success(`Quotation ${quotation.quotationNumber} created. Downloading PDF...`);
      reset({ customerName: '', address: '', mobileNumber: '', village: values.village, category: values.category });
      setPicked({});
      onCreated();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to create the quotation.'));
    }
  };

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="flex items-start gap-3 rounded-xl bg-primary/[0.06] p-3.5">
          <Sun className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
          <div className="text-sm">
            <p className="font-bold text-foreground">2.18 kW solar system</p>
            <p className="text-muted-foreground">APS 545W panels × 4 · Inverter APS / Solaryaan / Velox</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Customer Name" htmlFor="customerName" required error={errors.customerName?.message}>
            <Input id="customerName" autoComplete="off" placeholder="e.g. Hiteshbhai Patel" {...register('customerName')} />
          </FormField>
          <FormField label="Address" htmlFor="address" required error={errors.address?.message}>
            <Textarea id="address" rows={3} placeholder="House, street, village, district" {...register('address')} />
          </FormField>
          <FormField label="Mobile Number" htmlFor="mobileNumber" required error={errors.mobileNumber?.message}>
            <Input id="mobileNumber" inputMode="numeric" maxLength={10} {...register('mobileNumber')} />
          </FormField>

          <FormField label="Village" htmlFor="village" required>
            <div id="village" className="grid grid-cols-2 gap-2">
              {(['PIPLAV', 'OTHER'] as QuotationVillage[]).map((value) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-border/70 p-3 text-sm font-bold transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input type="radio" value={value} className="accent-[hsl(var(--primary))]" {...register('village')} />
                  {QUOTATION_VILLAGE_LABEL[value]}
                </label>
              ))}
            </div>
          </FormField>

          <FormField label="Category" htmlFor="category" required>
            <div id="category" className="grid grid-cols-2 gap-2">
              {categoryOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer flex-col gap-0.5 rounded-xl border border-border/70 p-3 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <span className="flex items-center gap-2 font-bold">
                    <input type="radio" value={option.value} className="accent-[hsl(var(--primary))]" {...register('category')} />
                    {option.label}
                  </span>
                  <span className="font-mono-brand text-xs tabular-nums text-muted-foreground">{formatCurrency(option.amount)}</span>
                </label>
              ))}
            </div>
          </FormField>

          {offered.length > 0 && (
            <FormField label="Add-ons (optional)" htmlFor="extras">
              <div id="extras" className="space-y-2">
                {offered.map((extra) => {
                  const isPicked = extra._id in picked;
                  return (
                    <div
                      key={extra._id}
                      className={cn(
                        'rounded-xl border border-border/70 text-sm transition-colors',
                        isPicked && 'border-primary bg-primary/5',
                      )}
                    >
                      <label className="flex cursor-pointer items-center gap-3 p-3">
                        <input
                          type="checkbox"
                          checked={isPicked}
                          onChange={() => toggleExtra(extra)}
                          className="h-4 w-4 accent-[hsl(var(--primary))]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-bold">{extra.name}</span>
                          {extra.description && <span className="block text-xs text-muted-foreground">{extra.description}</span>}
                        </span>
                      </label>
                      {isPicked && (
                        <div className="flex items-center gap-2 px-3 pb-3">
                          <label htmlFor={`extra-${extra._id}`} className="flex-1 text-xs font-semibold text-muted-foreground">
                            {extra.name} amount (₹)
                          </label>
                          <Input
                            id={`extra-${extra._id}`}
                            inputMode="numeric"
                            value={picked[extra._id]}
                            onChange={(e) =>
                              setPicked((current) => ({ ...current, [extra._id]: e.target.value.replace(/[^0-9]/g, '') }))
                            }
                            placeholder="Amount"
                            className="h-9 w-32 text-right font-mono-brand tabular-nums"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </FormField>
          )}

          <div className="space-y-1.5 rounded-xl border border-border/70 px-4 py-3">
            {ticked.length > 0 && (
              <div className="space-y-1 border-b border-border/60 pb-2 font-mono-brand text-xs tabular-nums text-muted-foreground">
                <p className="flex justify-between gap-3">
                  <span className="font-sans">Panels + inverter</span>
                  {formatCurrency(systemPrice)}
                </p>
                {ticked.map((e) => (
                  <p key={e._id} className="flex justify-between gap-3">
                    <span className="truncate font-sans">{e.name}</span>
                    {formatCurrency(e.amount)}
                  </p>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-muted-foreground">Quotation total</span>
              <span className="font-mono-brand text-lg font-extrabold tabular-nums text-primary">{formatCurrency(amount)}</span>
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
            {!isSubmitting && (
              <>
                <FileText className="h-4 w-4" /> Create &amp; Download PDF
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function QuotationsPage() {
  const role = useAuth().user?.role;
  const isStaff = role === 'QUOTATION_STAFF';
  // Staff get their own form (other village + policy tick); Mukt's form stays as it is.
  const canCreate = role === 'ADMIN' || role === 'QUOTATION' || isStaff;
  const usesAddOns = role === 'ADMIN' || role === 'QUOTATION';
  const canEdit = canCreate;
  const canSeeHistory = role === 'ADMIN' || role === 'VIEWER';
  const canDelete = role === 'ADMIN';

  const [quotations, setQuotations] = React.useState<Quotation[]>([]);
  const [pagination, setPagination] = React.useState<PaginationMeta | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const debouncedSearch = useDebounce(search, 350);
  const [editing, setEditing] = React.useState<Quotation | null>(null);

  // Admins and viewers can narrow the list to one person's quotations.
  const [makers, setMakers] = React.useState<Agent[]>([]);
  const [createdBy, setCreatedBy] = React.useState('');
  React.useEffect(() => {
    if (!canSeeHistory) return;
    agentService
      .listAgents()
      .then((list) => setMakers(list.filter((a) => a.role === 'QUOTATION' || a.role === 'QUOTATION_STAFF')))
      .catch(() => setMakers([]));
  }, [canSeeHistory]);

  const load = React.useCallback(() => {
    setLoading(true);
    quotationService
      .listQuotations({ search: debouncedSearch || undefined, createdBy: createdBy || undefined, page, limit: 20 })
      .then((data) => {
        setQuotations(data.quotations);
        setPagination(data.pagination);
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [debouncedSearch, createdBy, page]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, createdBy]);

  const [extras, setExtras] = React.useState<QuotationExtra[]>([]);
  const loadExtras = React.useCallback(() => {
    quotationService
      .listExtras()
      .then(setExtras)
      .catch((err) => toast.error(getErrorMessage(err, 'Unable to load add-ons.')));
  }, []);
  React.useEffect(() => {
    if (usesAddOns) loadExtras();
  }, [usesAddOns, loadExtras]);

  const handleDelete = async (q: Quotation) => {
    if (!window.confirm(`Delete quotation ${q.quotationNumber} for ${q.customerName}?`)) return;
    try {
      await quotationService.deleteQuotation(q._id);
      toast.success('Quotation deleted.');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="text-[1.75rem] font-extrabold tracking-tight text-foreground">Quotations</h1>
        <p className="text-sm text-muted-foreground">
          {isStaff
            ? 'Other village quotations - fill in the customer details and download the PDF.'
            : canCreate
              ? 'Fill in the customer details - the PDF is made from the Piplav template.'
              : 'All quotations made so far.'}
        </p>
      </div>

      <div className={cn('grid gap-5', canCreate && 'lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]')}>
        {canCreate && (
          <div className="space-y-5">
            {isStaff ? (
              <StaffQuotationCard onCreated={() => (page === 1 ? load() : setPage(1))} />
            ) : (
              <NewQuotationCard extras={extras} onCreated={() => (page === 1 ? load() : setPage(1))} />
            )}
            {role === 'ADMIN' && <AddOnsManager extras={extras} onChanged={loadExtras} />}
          </div>
        )}

        <div className="min-w-0 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, mobile or quotation no."
                className="pl-9"
                aria-label="Search quotations"
              />
            </div>
            {canSeeHistory && makers.length > 0 && (
              <select
                value={createdBy}
                onChange={(e) => setCreatedBy(e.target.value)}
                aria-label="Filter by who made it"
                className="h-10 rounded-xl border border-input bg-background px-3 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Made by anyone</option>
                {makers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.role === 'QUOTATION_STAFF' ? ' (staff)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)
          ) : quotations.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title={debouncedSearch ? 'No matching quotations' : 'No quotations yet'}
              description={canCreate && !debouncedSearch ? 'Your quotations will appear here.' : undefined}
            />
          ) : (
            quotations.map((q) => (
              <Card key={q._id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-bold text-foreground">{q.customerName}</p>
                    <p className="font-mono-brand text-xs text-muted-foreground">
                      {q.quotationNumber} · {q.mobileNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(q.createdAt)} · {QUOTATION_VILLAGE_LABEL[q.village ?? 'PIPLAV']} ·{' '}
                      {QUOTATION_CATEGORY_LABEL[q.category]}
                      {q.extras?.length ? ` + ${q.extras.map((e) => e.name).join(', ')}` : ''} · by {q.createdByName}
                      {q.updatedByName ? ` · edited by ${q.updatedByName}` : ''}
                    </p>
                    {q.policyIncluded === false && <p className="text-xs font-bold text-destructive">Policy not included</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono-brand text-sm font-extrabold tabular-nums text-primary">{formatCurrency(q.amount)}</span>
                    {canEdit && (
                      <Button size="sm" variant="outline" onClick={() => setEditing(q)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                    )}
                    <Button asChild size="sm" variant="outline">
                      <a href={quotationService.quotationPdfUrl(q._id, true)} target="_blank" rel="noopener">
                        <Eye className="h-3.5 w-3.5" /> View
                      </a>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <a href={quotationService.quotationPdfUrl(q._id)} rel="noopener">
                        <Download className="h-3.5 w-3.5" /> PDF
                      </a>
                    </Button>
                    {canSeeHistory && (
                      <Button asChild size="sm" variant="ghost" title="History" aria-label="Quotation history">
                        <Link
                          to={`/quotations/history?quotation=${q._id}&label=${encodeURIComponent(`${q.quotationNumber} - ${q.customerName}`)}`}
                        >
                          <History className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                    {canDelete && (
                      <Button size="sm" variant="ghost" title="Delete" aria-label="Delete quotation" onClick={() => handleDelete(q)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} quotations
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <Button size="sm" variant="outline" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <EditQuotationDialog quotation={editing} onClose={() => setEditing(null)} onSaved={load} />
    </div>
  );
}
