import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { solarInfoSchema, type SolarInfoForm } from '@/schemas/lead.schema';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { StepActions } from './StepActions';
import { PIPLAV_DEFAULTS, type SolarInformation } from '@/types';

export function SolarInfoStep({
  defaultValues,
  onNext,
  onBack,
  saving,
}: {
  defaultValues?: SolarInformation;
  onNext: (data: SolarInfoForm) => void;
  onBack: () => void;
  saving?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SolarInfoForm>({
    resolver: zodResolver(solarInfoSchema),
    defaultValues: {
      requiredSystemSizeKw: defaultValues?.requiredSystemSizeKw ?? PIPLAV_DEFAULTS.systemSizeKw,
    },
  });

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-4 p-4">
      <FormField label="System Size (kW)" htmlFor="requiredSystemSizeKw" error={errors.requiredSystemSizeKw?.message}>
        <Input id="requiredSystemSizeKw" type="number" step="0.01" min={0} {...register('requiredSystemSizeKw')} />
      </FormField>
      <p className="text-xs text-muted-foreground">
        Standard Piplav village rooftop system: {PIPLAV_DEFAULTS.systemSizeKw} kW.
      </p>

      <StepActions onBack={onBack} saving={saving} />
    </form>
  );
}
