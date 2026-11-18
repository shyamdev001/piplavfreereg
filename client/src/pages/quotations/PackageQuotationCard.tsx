import * as React from 'react';
import { useForm, type UseFormRegister } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { FileText, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import { Card, CardContent } from '@/components/ui/card';
import { getErrorMessage } from '@/lib/axios';
import { formatCurrency } from '@/lib/utils';
import * as quotationService from '@/services/quotation.service';
import {
  PACKAGE_BRANDS,
  PACKAGE_DONGLE_PRICE,
  PACKAGE_INSURANCE_PRICE,
  PACKAGE_PANEL_COUNTS,
  packageSizeKw,
  packageTotal,
  packageVariant,
  type PackageBrand,
} from '@/services/quotation.service';

// The PDF prints Latin text only, so Gujarati/Hindi typing is caught here first.
const englishOnly = /^[\x20-\x7E\r\n]*$/;

const packageSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(2, 'Name is required')
    .regex(englishOnly, 'Please type the name in English'),
  address: z
    .string()
    .trim()
    .min(2, 'Address is required')
    .regex(englishOnly, 'Please type the address in English'),
  mobileNumber: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, 'Enter a valid 10-digit mobile number'),
  brand: z.enum(['APS', 'ADANI', 'WAAREE']),
  panelType: z.string().min(1, 'Choose the panel type'),
  panelCount: z.coerce.number().int().min(6).max(10),
});
type PackageForm = z.infer<typeof packageSchema>;

/** The part of a form the company/size picker needs. */
export type PickerFields = { brand: PackageBrand; panelType: string; panelCount: number };

const BRANDS = Object.keys(PACKAGE_BRANDS) as PackageBrand[];

/**
 * Company + panel type + size picker shared by the create form and the edit dialog.
 * Prices shown are full totals.
 */
export function PackagePicker({
  brand,
  panelType,
  register,
  onPanelTypeChange,
}: {
  brand: PackageBrand;
  panelType: string | undefined;
  register: UseFormRegister<PickerFields>;
  onPanelTypeChange: (panelType: string) => void;
}) {
  const variants = PACKAGE_BRANDS[brand].variants;
  // A new company: switch to its first panel type if the chosen one isn't offered.
  React.useEffect(() => {
    if (!variants.some((v) => v.id === panelType)) onPanelTypeChange(variants[0].id);
  }, [variants, panelType, onPanelTypeChange]);

  return (
    <>
      <FormField label="Company" htmlFor="pkg-brand" required>
        <div id="pkg-brand" className="grid grid-cols-3 gap-2">
          {BRANDS.map((b) => (
            <label
              key={b}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border/70 p-3 text-sm font-bold transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input type="radio" value={b} className="accent-[hsl(var(--primary))]" {...register('brand')} />
              {PACKAGE_BRANDS[b].label}
            </label>
          ))}
        </div>
      </FormField>
      <FormField label="Panel type" htmlFor="pkg-type" required>
        <div id="pkg-type" className="grid grid-cols-2 gap-2">
          {variants.map((v) => (
            <label
              key={v.id}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-border/70 p-3 text-sm font-bold transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input
                type="radio"
                value={v.id}
                className="accent-[hsl(var(--primary))]"
                {...register('panelType')}
              />
              {v.label}
            </label>
          ))}
        </div>
      </FormField>
      <FormField label="System size" htmlFor="pkg-size" required>
        <div id="pkg-size" className="grid grid-cols-2 gap-2">
          {PACKAGE_PANEL_COUNTS.map((n) => (
            <label
              key={n}
              className="flex cursor-pointer flex-col gap-0.5 rounded-xl border border-border/70 p-3 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <span className="flex items-center gap-2 font-bold">
                <input
                  type="radio"
                  value={n}
                  className="accent-[hsl(var(--primary))]"
                  {...register('panelCount')}
                />
                {packageSizeKw(brand, panelType, n).toFixed(2)} kW
              </span>
              <span className="text-xs text-muted-foreground">
                {n} panels ·{' '}
                <span className="font-mono-brand tabular-nums">
                  {formatCurrency(packageTotal(brand, panelType, n).total)}
                </span>
              </span>
            </label>
          ))}
        </div>
      </FormField>
    </>
  );
}

/** Panels + inverter, insurance and dongle lines with the total (all always included). */
export function PackageBreakdown({
  brand,
  panelType,
  panelCount,
}: {
  brand: PackageBrand;
  panelType: string | undefined;
  panelCount: number;
}) {
  const { systemPrice, total } = packageTotal(brand, panelType, panelCount);
  return (
    <div className="space-y-1.5 rounded-xl border border-border/70 px-4 py-3">
      <div className="space-y-1 border-b border-border/60 pb-2 font-mono-brand text-xs tabular-nums text-muted-foreground">
        <p className="flex justify-between gap-3">
          <span className="font-sans">Panels ({packageVariant(brand, panelType).label}) + inverter</span>
          {formatCurrency(systemPrice)}
        </p>
        <p className="flex justify-between gap-3">
          <span className="font-sans">Insurance (5 years)</span>
          {formatCurrency(PACKAGE_INSURANCE_PRICE)}
        </p>
        <p className="flex justify-between gap-3">
          <span className="font-sans">WiFi dongle</span>
          {formatCurrency(PACKAGE_DONGLE_PRICE)}
        </p>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-muted-foreground">Quotation total</span>
        <span className="font-mono-brand text-lg font-extrabold tabular-nums text-primary">
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}

/**
 * Bigger systems from APS, Adani or Waaree (6-10 panels). Same price for every
 * village and category. Insurance and the WiFi dongle are always included.
 */
export function PackageQuotationCard({ onCreated }: { onCreated: () => void }) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PackageForm>({
    resolver: zodResolver(packageSchema),
    defaultValues: { brand: 'WAAREE', panelType: 'MONO_540', panelCount: 8 },
  });
  const brand = watch('brand');
  const panelType = watch('panelType');
  const panelCount = Number(watch('panelCount'));
  const setPanelType = React.useCallback((id: string) => setValue('panelType', id), [setValue]);

  const onSubmit = async (values: PackageForm) => {
    try {
      const quotation = await quotationService.createPackageQuotation(values);
      quotationService.downloadQuotationPdf(quotation._id);
      toast.success(`Quotation ${quotation.quotationNumber} created. Downloading PDF...`);
      reset({ ...values, customerName: '', address: '', mobileNumber: '' });
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
            <p className="font-bold text-foreground">Bigger solar system (6 to 10 panels)</p>
            <p className="text-muted-foreground">
              APS, Adani or Waaree · Mono Bifacial or TOPCon panels · Inverter APS / Solaryaan / Velox ·
              Insurance and WiFi dongle included
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Customer Name" htmlFor="pkg-name" required error={errors.customerName?.message}>
            <Input
              id="pkg-name"
              autoComplete="off"
              placeholder="e.g. Hiteshbhai Patel"
              {...register('customerName')}
            />
          </FormField>
          <FormField label="Address" htmlFor="pkg-address" required error={errors.address?.message}>
            <Textarea
              id="pkg-address"
              rows={3}
              placeholder="House, street, village, district"
              {...register('address')}
            />
          </FormField>
          <FormField label="Mobile Number" htmlFor="pkg-mobile" required error={errors.mobileNumber?.message}>
            <Input id="pkg-mobile" inputMode="numeric" maxLength={10} {...register('mobileNumber')} />
          </FormField>

          <PackagePicker
            brand={brand}
            panelType={panelType}
            register={register as unknown as UseFormRegister<PickerFields>}
            onPanelTypeChange={setPanelType}
          />

          <PackageBreakdown brand={brand} panelType={panelType} panelCount={panelCount} />

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
