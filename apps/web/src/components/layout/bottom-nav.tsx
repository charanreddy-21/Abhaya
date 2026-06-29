'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock3, LayoutDashboard, Siren, Users, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

const BOTTOM_NAV_ITEMS = [
  { href: '/', icon: LayoutDashboard, label: 'Home' },
  { href: '/trip', icon: Clock3, label: 'Trip' },
  { href: '/sos/active', icon: Siren, label: 'SOS', accent: true },
  { href: '/contacts', icon: Users, label: 'Contacts' },
  { href: '/safe-places', icon: MapPin, label: 'Places' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {BOTTOM_NAV_ITEMS.map(({ href, icon: Icon, label, accent }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn('bottom-nav-item', active && 'is-active', accent && 'is-accent')}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
          >
            <span className={cn('bottom-nav-icon', accent && 'is-accent-icon')}>
              <Icon size={accent ? 22 : 20} />
            </span>
            <span className="bottom-nav-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
