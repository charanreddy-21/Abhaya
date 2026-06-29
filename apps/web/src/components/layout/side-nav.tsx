'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  FileVideo,
  History,
  LayoutDashboard,
  LogIn,
  LogOut,
  MapPin,
  Settings,
  ShieldAlert,
  Siren,
  Clock3,
  Users,
} from 'lucide-react';
import { AbhayaGlyph } from '@/components/brand/abhaya-glyph';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/',              icon: LayoutDashboard, label: 'Home' },
  { href: '/sos/active',    icon: Siren,           label: 'SOS',        accent: true },
  { href: '/trip',          icon: Clock3,          label: 'Safe Trip',  authOnly: true },
  { href: '/contacts',      icon: Users,           label: 'Contacts',   authOnly: true },
  { href: '/sos/history',   icon: History,         label: 'History',    authOnly: true },
  { href: '/witness/alert', icon: Users,            label: 'Witness' },
  { href: '/evidence',      icon: FileVideo,        label: 'Evidence' },
  { href: '/safe-places',   icon: MapPin,           label: 'Safe Places' },
  { href: '/admin',         icon: ShieldAlert,      label: 'Admin',      adminOnly: true },
  { href: '/settings',      icon: Settings,         label: 'Settings' },
];

export function SideNav() {
  const pathname  = usePathname();
  const router    = useRouter();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { toast } = useToast();

  function handleLogout() {
    logout();
    toast('Signed out successfully.', 'ok');
    router.push('/auth/login');
  }

  return (
    <nav className="side-nav" aria-label="Main navigation">
      <Link href="/" className="side-nav-brand" aria-label="Abhaya home">
        <span className="side-brand-mark" aria-hidden="true">
          <AbhayaGlyph />
        </span>
      </Link>

      <div className="side-nav-links">
        {NAV_ITEMS.filter((item) => {
          if (item.adminOnly && !isAdmin) return false;
          if ((item as { authOnly?: boolean }).authOnly && !isAuthenticated) return false;
          return true;
        }).map(({ href, icon: Icon, label, accent }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn('side-nav-item', active && 'is-active', accent && 'is-accent')}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={20} />
              <span className="side-nav-label">{label}</span>
            </Link>
          );
        })}
      </div>

      <div className="side-nav-footer">
        {isAuthenticated && user ? (
          <>
            <div className="side-nav-user">
              <span className="side-nav-user-name">{user.display_name}</span>
              <span className="side-nav-user-role">{user.role}</span>
            </div>
            <button
              className="side-nav-item side-nav-logout"
              onClick={handleLogout}
              type="button"
              aria-label="Sign out"
            >
              <LogOut size={20} />
              <span className="side-nav-label">Sign out</span>
            </button>
          </>
        ) : (
          <Link href="/auth/login" className="side-nav-item">
            <LogIn size={20} />
            <span className="side-nav-label">Sign in</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
