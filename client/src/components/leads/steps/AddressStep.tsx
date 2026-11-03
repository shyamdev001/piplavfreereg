import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { addressSchema, type AddressForm } from '@/schemas/lead.schema';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StepActions } from './StepActions';
import { PIPLAV_DEFAULTS, type CustomerAddress } from '@/types';

export function AddressStep({
  defaultValues,
  onNext,
  onBack,
  saving,
}: {
  defaultValues?: CustomerAddress;
  onNext: (data: AddressForm) => void;
  onBack: () => void;
  saving?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      fullAddress: defaultValues?.fullAddress ?? '',
      cityVillage: defaultValues?.cityVillage || PIPLAV_DEFAULTS.cityVillage,
      district: defaultValues?.district || PIPLAV_DEFAULTS.district,
      state: defaultValues?.state || PIPLAV_DEFAULTS.state,
      pincode: defaultValues?.pincode || PIPLAV_DEFAULTS.pincode,
    },
  });

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-4 p-4">
      <FormField label="Full Address" htmlFor="fullAddress" required error={errors.fullAddress?.message}>
        <Textarea id="fullAddress" placeholder="House no., faliyu / street, landmark" {...register('fullAddress')} />
      </FormField>

      <FormField label="City / Village" htmlFor="cityVillage" required error={errors.cityVillage?.message}>
        <Input id="cityVillage" {...register('cityVillage')} />
      </FormField>

      <FormField label="District" htmlFor="district" required error={errors.district?.message}>
        <Input id="district" {...register('district')} />
      </FormField>

      <FormField label="State" htmlFor="state" required error={errors.state?.message}>
        <Input id="state" {...register('state')} />
      </FormField>

      <FormField label="PIN Code" htmlFor="pincode" required error={errors.pincode?.message}>
        <Input id="pincode" inputMode="numeric" maxLength={6} {...register('pincode')} />
      </FormField>

      <StepActions onBack={onBack} saving={saving} />
    </form>
  );
}
