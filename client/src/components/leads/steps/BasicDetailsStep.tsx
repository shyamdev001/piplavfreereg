import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { basicDetailsSchema, type BasicDetailsForm } from '@/schemas/lead.schema';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { StepActions } from './StepActions';
import { PIPLAV_DEFAULTS, type CustomerBasicDetails } from '@/types';

export function BasicDetailsStep({
  defaultValues,
  onNext,
  saving,
}: {
  defaultValues?: CustomerBasicDetails;
  onNext: (data: BasicDetailsForm) => void;
  saving?: boolean;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BasicDetailsForm>({
    resolver: zodResolver(basicDetailsSchema),
    defaultValues: {
      fullName: defaultValues?.fullName ?? '',
      fatherHusbandName: defaultValues?.fatherHusbandName ?? '',
      mobileNumber: defaultValues?.mobileNumber ?? '',
      alternateMobileNumber: defaultValues?.alternateMobileNumber ?? '',
      email: defaultValues?.email ?? '',
      customerType: defaultValues?.customerType ?? PIPLAV_DEFAULTS.customerType,
    },
  });

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-4 p-4">
      <FormField label="Customer Full Name" htmlFor="fullName" required error={errors.fullName?.message}>
        <Input id="fullName" placeholder="e.g. Rahul Patel" {...register('fullName')} />
      </FormField>

      <FormField label="Father / Husband Name" htmlFor="fatherHusbandName" error={errors.fatherHusbandName?.message}>
        <Input id="fatherHusbandName" placeholder="Optional" {...register('fatherHusbandName')} />
      </FormField>

      <FormField label="Mobile Number" htmlFor="mobileNumber" required error={errors.mobileNumber?.message}>
        <Input id="mobileNumber" type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit number" {...register('mobileNumber')} />
      </FormField>

      <FormField label="Alternate Mobile Number" htmlFor="alternateMobileNumber" error={errors.alternateMobileNumber?.message}>
        <Input id="alternateMobileNumber" type="tel" inputMode="numeric" maxLength={10} placeholder="Optional" {...register('alternateMobileNumber')} />
      </FormField>

      <FormField label="Email Address" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" placeholder="Optional" {...register('email')} />
      </FormField>

      <FormField label="Customer Type" required error={errors.customerType?.message}>
        <Select value={watch('customerType')} onValueChange={(v) => setValue('customerType', v as BasicDetailsForm['customerType'], { shouldValidate: true })}>
          <SelectTrigger>
            <SelectValue placeholder="Select customer type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Residential">Residential</SelectItem>
            <SelectItem value="Commercial">Commercial</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      <StepActions showBack={false} saving={saving} />
    </form>
  );
}
