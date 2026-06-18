import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type BadgeTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  icon?: ReactNode;
  tone?: BadgeTone;
}

export function Badge({ children, className, icon, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span className={cn('ui-badge', `ui-badge-${tone}`, className)} {...props}>
      {icon ? <span className="ui-badge-icon">{icon}</span> : null}
      {children}
    </span>
  );
}
