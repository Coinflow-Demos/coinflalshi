import {InputHTMLAttributes, forwardRef} from 'react';
import {cn} from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({className, ...props}, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-ring',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
