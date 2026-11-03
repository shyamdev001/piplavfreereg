import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WizardStepMeta {
  key: string;
  label: string;
}

export function WizardStepIndicator({
  steps,
  currentIndex,
  completedIndexes,
}: {
  steps: WizardStepMeta[];
  currentIndex: number;
  completedIndexes: Set<number>;
}) {
  const percent = Math.round(((currentIndex + 1) / steps.length) * 100);

  return (
    <div className="border-b border-border/70 bg-card px-4 pb-4 pt-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <p className="text-[1.05rem] font-extrabold tracking-tight text-foreground">{steps[currentIndex]?.label}</p>
        <p className="flex-shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[0.7rem] font-bold text-muted-foreground">
          {currentIndex + 1} / {steps.length}
        </p>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-primary transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between">
        {steps.map((step, idx) => {
          const isDone = completedIndexes.has(idx);
          const isCurrent = idx === currentIndex;
          return (
            <div key={step.key} className="flex flex-1 flex-col items-center gap-1">
              <span
                className={cn(
                  'flex h-2 w-2 items-center justify-center rounded-full transition-all duration-200',
                  isDone
                    ? 'h-4 w-4 bg-success text-success-foreground'
                    : isCurrent
                      ? 'h-4 w-4 bg-primary shadow-warm-glow'
                      : 'bg-border',
                )}
              >
                {isDone && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
