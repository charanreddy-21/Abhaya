import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type StatusTone = 'ok' | 'warn' | 'danger' | 'info';

interface StatusCardProps {
  action?: ReactNode;
  icon: ReactNode;
  message: string;
  title: string;
  tone: StatusTone;
}

export function StatusCard({ action, icon, message, title, tone }: StatusCardProps) {
  return (
    <article className="status-card">
      <div className="status-row">
        <div className={cn('status-icon', `tone-${tone}`)}>{icon}</div>
        {action}
      </div>
      <div>
        <h3>{title}</h3>
        <p>{message}</p>
      </div>
    </article>
  );
}
