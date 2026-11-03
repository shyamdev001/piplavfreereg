import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold tracking-tight transition-[transform,box-shadow,background-color,color,opacity] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 active:scale-[0.97]',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_10px_hsl(var(--shadow-color)/0.16),0_2px_4px_hsl(var(--shadow-color)/0.10)] hover:bg-primary-dim hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_10px_24px_-4px_hsl(var(--shadow-color)/0.30)]',
        accent:
          'bg-accent text-accent-foreground shadow-warm-md hover:brightness-[1.04] hover:shadow-warm-lg',
        destructive: 'bg-destructive text-destructive-foreground shadow-warm-sm hover:bg-destructive/90',
        outline:
          'border border-input bg-card text-foreground shadow-warm-sm hover:border-primary/40 hover:bg-primary/5',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
        soft: 'bg-primary/10 text-primary hover:bg-primary/15',
        ghost: 'hover:bg-secondary/80 hover:text-secondary-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-5 py-2',
        sm: 'h-9 rounded-md px-3.5 text-xs',
        lg: 'h-[3.25rem] rounded-xl px-7 text-[0.95rem]',
        xl: 'h-16 rounded-2xl px-9 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, disabled, children, ...props }, ref) => {
    // Radix Slot requires exactly one element child, so the loading spinner
    // (which asChild callers - e.g. Link-wrapping buttons - don't use anyway)
    // must not be injected alongside `children` in that branch.
    if (asChild) {
      return (
        <Slot className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
          {children}
        </Slot>
      );
    }
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
