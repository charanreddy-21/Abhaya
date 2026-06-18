import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MetricRowProps {
  icon: ReactNode;
  label: string;
  tone?: 'ok' | 'warn' | 'danger' | 'info';
  value: string;
}

export function MetricRow({ icon, label, tone = 'info', value }: MetricRowProps) {
  return (
    <div className="metric-row">
      <span className={cn('metric-icon', `tone-${tone}`)} aria-hidden="true">
        {icon}
      </span>
      <div>
        <p className="metric-label">{label}</p>
        <p className="metric-value">{value}</p>
      </div>
    </div>
  );
}
