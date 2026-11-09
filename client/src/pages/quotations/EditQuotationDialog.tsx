import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getErrorMessage } from '@/lib/axios';
import { cn, formatCurrency } from '@/lib/utils';
import * as quotationService from '@/services/quotation.service';
import {
  QUOTATION_CATEGORY_OPTIONS,
  QUOTATION_VILLAGE_LABEL,
  STAFF_CATEGORY_OPTIONS,
  STAFF_POLICY_PRICE,
  staffQuotationTotal,
  type Quotation,
} from '@/services/quotation.service';

const englishOnly = /^[\x20-\x7E\r\n]*$/;

const editSchema = z.object({
  customerName: z.string().trim().min(2, 'Name is required').regex(englishOnly, 'Please type the name in English'),
  address: z.string().trim().min(2, 'Address is required').regex(englishOnly, 'Please type the address in English'),
  mobileNumber: z.string().trim().regex(/^[0-9]{10}$/, 'Enter a valid 10-digit mobile number'),
  category: z.enum(['GENERAL', 'SC_ST', 'PASHUPALAK']),
  policyIncluded: z.boolean(),
});
type EditForm = z.infer<typeof editSchema>;

/**
 * Edit a saved quotation. The number and date stay; the server recalculates the
 * price and records what changed in the quotation history.
 */
export function EditQuotationDialog({
  quotation,
  onClose,
  onSaved,
}: {
  quotation: Quotation | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isStaff = quotation?.kind === 'STAFF';
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EditForm>({ resolver: zodResolver(editSchema) });

  React.useEffect(() => {
    if (quotation) {
      reset({
        customerName: quotation.customerName,
        address: quotation.address,
        mobileNumber: quotation.mobileNumber,
        category: quotation.category,
        policyIncluded: quotation.policyIncluded !== false,
      });
    }
  }, [quotation, reset]);

  const category = watch('category');
  const policyIncluded = watch('policyIncluded');
  const village = quotation?.village ?? 'PIPLAV';
  const categoryOptions = isStaff ? STAFF_CATEGORY_OPTIONS : QUOTATION_CATEGORY_OPTIONS[village];

  // Preview of the new total (the server makes the final calculation).
  let total = quotation?.amount ?? 0;
  if (quotation && category) {
    if (isStaff) total = staffQuotationTotal(category, policyIncluded).total;
    else {
      const base = categoryOptions.find((o) => o.value === category)?.amount ?? 0;
      const onTop = (quotation.extras ?? []).filter((e) => !e.includedInPrice).reduce((s, e) => s + e.price, 0);
      total = base + onTop;
    }
  }

  const onSubmit = async (values: EditForm) => {
    if (!quotation) return;
    // Only staff quotations have the policy tick.
    const payload = isStaff
      ? values
      : { customerName: values.customerName, address: values.address, mobileNumber: values.mobileNumber, category: values.category };
    try {
      await quotationService.updateQuotation(quotation._id, payload);
      toast.success(`Quotation ${quotation.quotationNumber} updated.`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to update the quotation.'));
    }
  };

  return (
    <Dialog open={!!quotation} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit quotation</DialogTitle>
          <DialogDescription>
            {quotation?.quotationNumber} · {QUOTATION_VILLAGE_LABEL[village]}. The number and date stay the same; the change is
            saved in the history.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Customer Name" htmlFor="edit-name" required error={errors.customerName?.message}>
            <Input id="edit-name" autoComplete="off" {...register('customerName')} />
          </FormField>
          <FormField label="Address" htmlFor="edit-address" required error={errors.address?.message}>
            <Textarea id="edit-address" rows={3} {...register('address')} />
          </FormField>
          <FormField label="Mobile Number" htmlFor="edit-mobile" required error={errors.mobileNumber?.message}>
            <Input id="edit-mobile" inputMode="numeric" maxLength={10} {...register('mobileNumber')} />
          </FormField>
          <FormField label="Category" htmlFor="edit-category" required>
            <div id="edit-category" className="grid grid-cols-2 gap-2">
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
          {isStaff && (
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
          )}
          {!isStaff && (quotation?.extras?.length ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground">
              Add-ons ({quotation!.extras!.map((e) => `${e.name} ${formatCurrency(e.price)}`).join(', ')}) stay as they are. To change
              them, make a new quotation.
            </p>
          )}
          <div className="flex items-center justify-between rounded-xl border border-border/70 px-4 py-3">
            <span className="text-sm font-bold text-muted-foreground">Total after saving</span>
            <span className="font-mono-brand text-lg font-extrabold tabular-nums text-primary">{formatCurrency(total)}</span>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
