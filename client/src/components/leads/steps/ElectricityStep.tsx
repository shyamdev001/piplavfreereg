import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { electricitySchema, type ElectricityForm } from '@/schemas/lead.schema';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { StepActions } from './StepActions';
import type { ElectricityDetails } from '@/types';

export function ElectricityStep({
  defaultValues,
  onNext,
  onBack,
  saving,
}: {
  defaultValues?: ElectricityDetails;
  onNext: (data: ElectricityForm) => void;
  onBack: () => void;
  saving?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ElectricityForm>({
    resolver: zodResolver(electricitySchema),
    defaultValues: {
      consumerName: defaultValues?.consumerName ?? '',
      consumerNumber: defaultValues?.consumerNumber ?? '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-4 p-4">
      <FormField label="Electricity Consumer Name" htmlFor="consumerName" required error={errors.consumerName?.message}>
        <Input id="consumerName" placeholder="Name as printed on the electricity bill" {...register('consumerName')} />
      </FormField>

      <FormField label="Consumer Number" htmlFor="consumerNumber" required error={errors.consumerNumber?.message}>
        <Input id="consumerNumber" inputMode="numeric" placeholder="From the electricity bill" {...register('consumerNumber')} />
      </FormField>

      <StepActions onBack={onBack} saving={saving} />
    </form>
  );
}
