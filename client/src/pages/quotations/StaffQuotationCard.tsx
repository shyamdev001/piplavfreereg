import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AlertTriangle, FileText, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import { Card, CardContent } from '@/components/ui/card';
import { getErrorMessage } from '@/lib/axios';
import { cn, formatCurrency } from '@/lib/utils';
import * as quotationService from '@/services/quotation.service';
import { STAFF_CATEGORY_OPTIONS, STAFF_POLICY_PRICE, staffQuotationTotal } from '@/services/quotation.service';

// The PDF prints Latin text only, so Gujarati/Hindi typing is caught here first.
const englishOnly = /^[\x20-\x7E\r\n]*$/;

const staffSchema = z.object({
  customerName: z.string().trim().min(2, 'Name is required').regex(englishOnly, 'Please type the name in English'),
  address: z.string().trim().min(2, 'Address is required').regex(englishOnly, 'Please type the address in English'),
  mobileNumber: z.string().trim().regex(/^[0-9]{10}$/, 'Enter a valid 10-digit mobile number'),
  category: z.enum(['GENERAL', 'PASHUPALAK']),
  policyIncluded: z.boolean(),
});
type StaffForm = z.infer<typeof staffSchema>;

/**
 * Quotation form for staff: Other village only, same 2.18 kW system and prices,
 * with the Rs 700 policy ticked by default. Unticking it takes Rs 700 off the
 * total and the PDF says the policy is not included.
 */
export function StaffQuotationCard({ onCreated }: { onCreated: () => void }) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StaffForm>({
    resolver: zodResolver(staffSchema),
    defaultValues: { category: 'GENERAL', policyIncluded: true },
  });
  const category = watch('category');
  const policyIncluded = watch('policyIncluded');
  const { systemPrice, total } = staffQuotationTotal(category, policyIncluded);

  const onSubmit = async (values: StaffForm) => {
    try {
      const quotation = await quotationService.createQuotation({ ...values, village: 'OTHER', extras: [] });
      quotationService.downloadQuotationPdf(quotation._id);
      toast.success(`Quotation ${quotation.quotationNumber} created. Downloading PDF...`);
      reset({ customerName: '', address: '', mobileNumber: '', category: values.category, policyIncluded: true });
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
            <p className="font-bold text-foreground">2.18 kW solar system · Other village</p>
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

          <FormField label="Category" htmlFor="category" required>
            <div id="category" className="grid grid-cols-2 gap-2">
              {STAFF_CATEGORY_OPTIONS.map((option) => (
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

          <label
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition-colors',
              policyIncluded ? 'border-primary bg-primary/5' : 'border-destructive/50 bg-destructive/5',
            )}
          >
            <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" {...register('policyIncluded')} />
            <span className="flex-1 font-bold">Policy included</span>
            <span className="font-mono-brand text-xs tabular-nums text-muted-foreground">{formatCurrency(STAFF_POLICY_PRICE)}</span>
          </label>
          {!policyIncluded && (
            <p className="flex items-start gap-2 text-xs font-semibold text-destructive">
              <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0" />
              Policy not included: {formatCurrency(STAFF_POLICY_PRICE)} is not added to the total and the PDF will say so.
            </p>
          )}

          <div className="space-y-1.5 rounded-xl border border-border/70 px-4 py-3">
            <div className="space-y-1 border-b border-border/60 pb-2 font-mono-brand text-xs tabular-nums text-muted-foreground">
              <p className="flex justify-between gap-3">
                <span className="font-sans">Panels + inverter</span>
                {formatCurrency(systemPrice)}
              </p>
              <p className="flex justify-between gap-3">
                <span className="font-sans">Policy</span>
                {policyIncluded ? formatCurrency(STAFF_POLICY_PRICE) : 'Not included'}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-muted-foreground">Quotation total</span>
              <span className="font-mono-brand text-lg font-extrabold tabular-nums text-primary">{formatCurrency(total)}</span>
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
