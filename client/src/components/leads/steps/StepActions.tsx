import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function StepActions({
  onBack,
  showBack = true,
  submitLabel = 'Next',
  saving,
}: {
  onBack?: () => void;
  showBack?: boolean;
  submitLabel?: string;
  saving?: boolean;
}) {
  return (
    <div
      className="sticky bottom-0 -mx-4 mt-8 flex gap-3 border-t border-border/70 bg-card/95 px-4 pt-4 backdrop-blur-sm"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      {showBack && (
        <Button type="button" variant="outline" size="lg" onClick={onBack} disabled={saving} className="flex-1">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
      )}
      <Button type="submit" size="lg" loading={saving} className="flex-1">
        {!saving && submitLabel}
        {!saving && submitLabel === 'Next' && <ChevronRight className="h-4 w-4" />}
      </Button>
    </div>
  );
}
