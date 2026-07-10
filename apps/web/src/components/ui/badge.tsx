import {HTMLAttributes} from 'react';
import {cn} from '@/lib/utils';

type BadgeVariant = 'default' | 'success' | 'destructive' | 'outline';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: 'bg-secondary text-secondary-foreground',
  success: 'bg-success/15 text-success',
  destructive: 'bg-destructive/15 text-destructive',
  outline: 'border border-border text-muted-foreground',
};

export function Badge({
  className,
  variant = 'default',
  ...props
}: HTMLAttributes<HTMLSpanElement> & {variant?: BadgeVariant}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    />
  );
}
