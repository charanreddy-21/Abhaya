'use client';

import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'role'> {
  checked: boolean;
  label: string;
}

export function Switch({ checked, className, label, type = 'button', ...props }: SwitchProps) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={cn('ui-switch', className)}
      role="switch"
      type={type}
      {...props}
    />
  );
}
