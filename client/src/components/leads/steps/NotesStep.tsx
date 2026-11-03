import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { notesSchema, type NotesForm } from '@/schemas/lead.schema';
import { FormField } from '@/components/ui/form-field';
import { Textarea } from '@/components/ui/textarea';
import { StepActions } from './StepActions';

export function NotesStep({
  defaultValue,
  onNext,
  onBack,
  saving,
}: {
  defaultValue?: string;
  onNext: (data: NotesForm) => void;
  onBack: () => void;
  saving?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NotesForm>({
    resolver: zodResolver(notesSchema),
    defaultValues: { notes: defaultValue ?? '' },
  });

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-4 p-4">
      <FormField label="Notes" htmlFor="notes" error={errors.notes?.message} hint="Anything else worth mentioning about this visit or customer.">
        <Textarea id="notes" rows={6} placeholder="Optional notes..." {...register('notes')} />
      </FormField>

      <StepActions onBack={onBack} submitLabel="Review" saving={saving} />
    </form>
  );
}
