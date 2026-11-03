import { cn } from '@/lib/utils';
import logoSrc from '@/assets/logo.png';

interface LogoProps {
  /** Pixel size of the emblem. */
  size?: number;
  /** How much text accompanies the emblem. */
  variant?: 'mark' | 'lockup' | 'full';
  /** Adds a soft halo behind the emblem for hero placements. */
  elevated?: boolean;
  className?: string;
  textClassName?: string;
}

export function Logo({ size = 40, variant = 'lockup', elevated = false, className, textClassName }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="relative inline-flex flex-shrink-0" style={{ width: size, height: size }}>
        {elevated && (
          <span
            aria-hidden
            className="absolute inset-[-18%] rounded-full bg-sunrise-deep opacity-60 blur-xl"
          />
        )}
        <img
          src={logoSrc}
          alt="The Solar Coop"
          width={size}
          height={size}
          className="relative h-full w-full select-none object-contain drop-shadow-[0_2px_6px_rgba(120,50,10,0.25)]"
          draggable={false}
        />
      </span>

      {variant === 'lockup' && (
        <span
          className={cn('font-extrabold leading-none tracking-tight text-foreground', textClassName)}
          style={{ fontSize: Math.max(14, size * 0.42) }}
        >
          Solar Coop
        </span>
      )}

      {variant === 'full' && (
        <span className={cn('leading-tight', textClassName)}>
          <span
            className="block font-extrabold uppercase tracking-[0.06em] text-foreground"
            style={{ fontSize: Math.max(15, size * 0.4) }}
          >
            The Solar Coop
          </span>
          <span
            className="block font-semibold uppercase tracking-[0.22em] text-primary"
            style={{ fontSize: Math.max(9, size * 0.16) }}
          >
            Piplav Solar Registration
          </span>
        </span>
      )}
    </div>
  );
}
