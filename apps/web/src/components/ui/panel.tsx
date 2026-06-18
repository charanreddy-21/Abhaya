import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PanelProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  eyebrow?: string;
  icon?: ReactNode;
  title?: string;
}

export function Panel({ children, className, eyebrow, icon, title, ...props }: PanelProps) {
  return (
    <section className={cn('ui-panel', className)} {...props}>
      {title ? (
        <div className="ui-panel-header">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2 className="section-title">{title}</h2>
          </div>
          {icon ? <div className="ui-panel-icon" aria-hidden="true">{icon}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
