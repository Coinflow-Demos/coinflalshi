import {Rocket} from 'lucide-react';
import {cn} from '@/lib/utils';

export function Logo({className}: {className?: string}) {
  return (
    <span className={cn('flex items-center gap-2 font-heading font-extrabold text-lg', className)}>
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Rocket className="h-4 w-4" strokeWidth={2.5} />
      </span>
      Coinflalshi
    </span>
  );
}
