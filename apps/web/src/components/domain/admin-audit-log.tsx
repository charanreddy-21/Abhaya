'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, ChevronDown, ChevronLeft, ChevronRight,
  Clock3, Filter, Globe, Lock, Shield,
} from 'lucide-react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { useQuery } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import type { AdminAuditEvent } from '@/lib/types';

const ACTION_FILTERS = [
  { label: 'All', value: undefined },
  { label: 'Auth', value: 'auth' },
  { label: 'SOS', value: 'sos' },
  { label: 'Evidence', value: 'evidence' },
  { label: 'Witness', value: 'witness' },
  { label: 'Admin', value: 'admin' },
] as const;

const PAGE_SIZE = 50;

function actionTone(action: string): 'danger' | 'warn' | 'ok' | 'info' {
  if (action.includes('failed') || action.includes('delete')) return 'danger';
  if (action.includes('admin') || action.includes('reveal')) return 'warn';
  if (action.includes('resolve')) return 'ok';
  return 'info';
}

export function AdminAuditLogView() {
  const [actionFilter, setActionFilter] = useState<string | undefined>(undefined);
  const [offset, setOffset]             = useState(0);

  const { data: page, isLoading, error, refresh } = useQuery(
    () => adminApi.listAuditLog({ action: actionFilter, limit: PAGE_SIZE, offset }),
    [actionFilter, offset],
    { intervalMs: 30_000 },
  );

  const totalPages = page ? Math.max(1, Math.ceil(page.total / PAGE_SIZE)) : 1;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  function setPage(p: number) {
    setOffset((p - 1) * PAGE_SIZE);
  }

  function handleFilterChange(value: string | undefined) {
    setActionFilter(value);
    setOffset(0);
  }

  return (
    <div className="view-container audit-view">
      <PageHeader
        eyebrow="Admin"
        title="Audit log"
        subtitle="All security-relevant system events. Access to this log is itself logged."
        actions={
          <Link href="/admin" className="btn btn-sm btn-ghost">
            <ChevronLeft size={14} />
            Back
          </Link>
        }
      />

      <div className="audit-toolbar">
        <div className="audit-filters" role="group" aria-label="Filter by action type">
          <Filter size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          {ACTION_FILTERS.map((f) => (
            <button
              key={String(f.value)}
              type="button"
              className={`filter-tab ${actionFilter === f.value ? 'is-active' : ''}`}
              onClick={() => handleFilterChange(f.value)}
            >
              {f.label}
              {f.value === actionFilter && page && ` (${page.total})`}
            </button>
          ))}
        </div>

        {page && (
          <p className="audit-count">
            {page.total.toLocaleString()} event{page.total !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {isLoading ? (
        <AuditLogSkeleton />
      ) : error ? (
        <div className="error-state">
          <AlertTriangle size={28} className="error-state-icon" />
          <h3>Could not load audit log</h3>
          <p>{error.message}</p>
          <Button variant="secondary" size="sm" onClick={refresh}>Retry</Button>
        </div>
      ) : (page?.events ?? []).length === 0 ? (
        <div className="error-state" style={{ paddingBlock: 32 }}>
          <Shield size={32} style={{ color: 'var(--muted)' }} />
          <h3>No audit events</h3>
          <p>Events will appear here as system activity occurs.</p>
        </div>
      ) : (
        <>
          <div className="audit-table" role="table" aria-label="Audit log events">
            <div className="audit-table-head" role="row">
              <span role="columnheader">Time</span>
              <span role="columnheader">Action</span>
              <span role="columnheader">Resource</span>
              <span role="columnheader">Actor</span>
              <span role="columnheader">IP</span>
            </div>
            <AnimatePresence mode="popLayout">
              {(page?.events ?? []).map((event, i) => (
                <AuditEventRow key={event.id} event={event} index={i} />
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
        <Lock size={13} />
        <p>
          Audit records are append-only and cannot be deleted through this interface.
          Access to this log is itself recorded.
        </p>
      </div>
    </div>
  );
}

function AuditEventRow({ event, index }: { event: AdminAuditEvent; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const tone = actionTone(event.action);
  const date = new Date(event.created_at);
  const dateStr = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <motion.div
      className="audit-row"
      role="row"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
    >
      <div className="audit-row-main" onClick={() => setExpanded((p) => !p)} role="button" tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded((p) => !p)}>
        <span className="audit-time" role="cell">
          <Clock3 size={11} />
          <span>{dateStr}</span>
          <span className="audit-time-secs">{timeStr}</span>
        </span>
        <span role="cell">
          <Badge tone={tone}>{event.action}</Badge>
        </span>
        <span className="audit-resource" role="cell">
          {event.resource_type}
          {event.resource_id && (
            <code className="audit-resource-id">{event.resource_id.slice(0, 8)}</code>
          )}
        </span>
        <span className="audit-actor" role="cell">{event.actor_label}</span>
        <span className="audit-ip" role="cell">
          {event.ip_address
            ? <><Globe size={11} /> {event.ip_address}</>
            : <span style={{ color: 'var(--muted)' }}>—</span>}
        </span>
        <ChevronDown
          size={14}
          className={`audit-expand-icon ${expanded ? 'is-expanded' : ''}`}
          aria-hidden
        />
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="audit-row-detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <dl className="audit-detail-grid">
              <dt>Event ID</dt>
              <dd><code>{event.id}</code></dd>
              <dt>Action</dt>
              <dd><code>{event.action}</code></dd>
              <dt>Resource type</dt>
              <dd>{event.resource_type}</dd>
              {event.resource_id && (
                <>
                  <dt>Resource ID</dt>
                  <dd><code>{event.resource_id}</code></dd>
                </>
              )}
              <dt>Actor</dt>
              <dd>{event.actor_label}</dd>
              <dt>IP address</dt>
              <dd>{event.ip_address ?? 'Not recorded'}</dd>
              <dt>Timestamp</dt>
              <dd>{date.toISOString()}</dd>
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AuditLogSkeleton() {
  return (
    <div className="audit-table">
      <div className="audit-table-head">
        <span>Time</span>
        <span>Action</span>
        <span>Resource</span>
        <span>Actor</span>
        <span>IP</span>
      </div>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="audit-row" aria-hidden>
          <div className="audit-row-main">
            <div className="skeleton skeleton-text" style={{ width: 90 }} />
            <div className="skeleton" style={{ width: 110, height: 22, borderRadius: 12 }} />
            <div className="skeleton skeleton-text" style={{ width: 80 }} />
            <div className="skeleton skeleton-text" style={{ width: 70 }} />
            <div className="skeleton skeleton-text" style={{ width: 60 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
