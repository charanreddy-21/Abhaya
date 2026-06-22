'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Bell, BellOff, ChevronLeft, ChevronRight,
  EyeOff, Shield, Siren, Users, UserCheck,
} from 'lucide-react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { useQuery } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import type { AdminUser } from '@/lib/types';

const ROLE_FILTERS = [
  { label: 'All', value: undefined },
  { label: 'Users', value: 'user' as const },
  { label: 'Admins', value: 'admin' as const },
];

const PAGE_SIZE = 50;

export function AdminUsersView() {
  const [roleFilter, setRoleFilter] = useState<'user' | 'admin' | undefined>(undefined);
  const [offset, setOffset] = useState(0);

  const { data: page, isLoading, error, refresh } = useQuery(
    () => adminApi.listUsers({ role: roleFilter, limit: PAGE_SIZE, offset }),
    [roleFilter, offset],
    { intervalMs: 60_000 },
  );

  const totalPages  = page ? Math.max(1, Math.ceil(page.total / PAGE_SIZE)) : 1;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  function setPage(p: number) { setOffset((p - 1) * PAGE_SIZE); }

  function handleFilterChange(v: 'user' | 'admin' | undefined) {
    setRoleFilter(v);
    setOffset(0);
  }

  const witnessOptInCount = (page?.users ?? []).filter((u) => u.witness_opt_in).length;

  return (
    <div className="view-container admin-users-view">
      <PageHeader
        eyebrow="Admin"
        title="User accounts"
        subtitle="All registered accounts. Email addresses are not shown here — see audit log for auth events."
        actions={
          <Link href="/admin" className="btn btn-sm btn-ghost">
            <ChevronLeft size={14} />
            Back
          </Link>
        }
      />

      <div className="admin-users-toolbar">
        <div className="audit-filters" role="group" aria-label="Filter by role">
          <Users size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          {ROLE_FILTERS.map((f) => (
            <button
              key={String(f.value)}
              type="button"
              className={`filter-tab ${roleFilter === f.value ? 'is-active' : ''}`}
              onClick={() => handleFilterChange(f.value)}
            >
              {f.label}
              {f.value === roleFilter && page ? ` (${page.total})` : ''}
            </button>
          ))}
        </div>

        {page && witnessOptInCount > 0 && (
          <p className="admin-users-witness-stat">
            <UserCheck size={13} />
            {witnessOptInCount} of {page.users.length} shown opted in as witnesses
          </p>
        )}
      </div>

      {isLoading ? (
        <UserTableSkeleton />
      ) : error ? (
        <div className="error-state">
          <AlertTriangle size={28} className="error-state-icon" />
          <h3>Could not load users</h3>
          <p>{error.message}</p>
          <Button variant="secondary" size="sm" onClick={refresh}>Retry</Button>
        </div>
      ) : (page?.users ?? []).length === 0 ? (
        <div className="error-state" style={{ paddingBlock: 32 }}>
          <Users size={32} style={{ color: 'var(--muted)' }} />
          <h3>No users found</h3>
        </div>
      ) : (
        <>
          <div className="admin-users-table">
            <div className="admin-users-head">
              <span>Display name</span>
              <span>Role</span>
              <span>Incidents</span>
              <span>Witness</span>
              <span>Anonymous</span>
              <span>Push</span>
              <span>Joined</span>
            </div>

            <AnimatePresence mode="popLayout">
              {(page?.users ?? []).map((user, i) => (
                <UserRow key={user.id} user={user} index={i} />
              ))}
            </AnimatePresence>
          </div>

          {totalPages > 1 && (
            <div className="audit-pagination">
              <Button
                variant="ghost"
                size="sm"
                icon={<ChevronLeft size={14} />}
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                Prev
              </Button>
              <span className="audit-page-label">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                icon={<ChevronRight size={14} />}
                disabled={currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <div className="audit-notice">
        <Shield size={13} />
        <p>
          Email addresses are intentionally not shown on this page. Check the auth audit log
          for login activity. Access to this page is recorded.
        </p>
      </div>
    </div>
  );
}

function UserRow({ user, index }: { user: AdminUser; index: number }) {
  const joinedDate = new Date(user.created_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <motion.div
      className="admin-users-row"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: Math.min(index * 0.025, 0.4) }}
    >
      <span className="admin-users-name">{user.display_name}</span>

      <span>
        {user.role === 'admin'
          ? <Badge tone="warn" icon={<Shield size={11} />}>Admin</Badge>
          : <Badge tone="neutral">User</Badge>}
      </span>

      <span className="admin-users-stat">
        {user.incident_count > 0
          ? <><Siren size={12} /> {user.incident_count}</>
          : <span style={{ color: 'var(--muted)' }}>0</span>}
      </span>

      <span>
        {user.witness_opt_in
          ? <Badge tone="ok" icon={<UserCheck size={11} />}>Opted in</Badge>
          : <span style={{ color: 'var(--muted)', fontSize: 12 }}>Off</span>}
      </span>

      <span>
        {user.anonymous_by_default
          ? <Badge tone="info" icon={<EyeOff size={11} />}>Anon</Badge>
          : <span style={{ color: 'var(--muted)', fontSize: 12 }}>Named</span>}
      </span>

      <span>
        {user.has_push
          ? <Bell size={14} style={{ color: 'var(--forest)' }} />
          : <BellOff size={14} style={{ color: 'var(--muted)' }} />}
      </span>

      <span className="admin-users-joined">{joinedDate}</span>
    </motion.div>
  );
}

function UserTableSkeleton() {
  return (
    <div className="admin-users-table">
      <div className="admin-users-head">
        <span>Display name</span>
        <span>Role</span>
        <span>Incidents</span>
        <span>Witness</span>
        <span>Anonymous</span>
        <span>Push</span>
        <span>Joined</span>
      </div>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="admin-users-row" aria-hidden>
          <div className="skeleton skeleton-text" style={{ width: '40%' }} />
          <div className="skeleton" style={{ width: 60, height: 22, borderRadius: 12 }} />
          <div className="skeleton skeleton-text" style={{ width: 24 }} />
          <div className="skeleton" style={{ width: 70, height: 22, borderRadius: 12 }} />
          <div className="skeleton skeleton-text" style={{ width: 40 }} />
          <div className="skeleton skeleton-text" style={{ width: 20 }} />
          <div className="skeleton skeleton-text" style={{ width: 80 }} />
        </div>
      ))}
    </div>
  );
}
