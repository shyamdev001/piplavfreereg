import * as React from 'react';
import { Card, CardContent } from './card';
import { cn } from '@/lib/utils';

type Tone = 'primary' | 'accent' | 'success' | 'info' | 'premium';

const TONE_STYLES: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/18 text-accent-foreground',
  success: 'bg-success/10 text-success',
  info: 'bg-info/10 text-info',
  premium: 'bg-premium/10 text-premium',
};

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  hint?: string;
  tone?: Tone;
  className?: string;
}

export function StatCard({ label, value, icon, hint, tone = 'primary', className }: StatCardProps) {
  return (
    <Card className={cn('group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-warm-md', className)}>
      <CardContent className="flex items-start justify-between gap-2 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-bold uppercase leading-tight tracking-wide text-muted-foreground sm:text-xs">
            {label}
          </p>
          <p className="mt-2 font-mono-brand text-2xl font-bold tabular-nums leading-none text-foreground sm:text-3xl">
            {value}
          </p>
          {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {icon && (
          <div
            className={cn(
              'flex-shrink-0 rounded-xl p-2 transition-transform duration-200 group-hover:scale-105 sm:p-2.5',
              TONE_STYLES[tone],
            )}
          >
            {icon}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
