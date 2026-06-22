'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, AlertTriangle, CheckCircle2, ChevronRight,
  Clock3, Eye, FileVideo, List, Loader2, MapPin, Shield, Siren, TrendingUp, Users,
} from 'lucide-react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useQuery } from '@/lib/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { MetricRow } from '@/components/ui/metric-row';
import { PageHeader } from '@/components/ui/page-header';
import { formatElapsed } from '@/lib/hooks';
import type { AdminIncident, IncidentStatus } from '@/lib/types';

type StatusFilter = IncidentStatus | 'all';

export function AdminCommandCenter() {
  const router  = useRouter();
  const { isAdmin, isAuthenticated } = useAuth();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const {
    data: metrics, isLoading: metricsLoading,
  } = useQuery(() => adminApi.getMetrics(), [], { intervalMs: 30_000 });

  const {
    data: incidents, isLoading: incidentsLoading, error, refresh,
  } = useQuery(() => adminApi.listIncidents(), [], { intervalMs: 15_000 });

  if (!isAuthenticated) {
    return (
      <div className="view-container">
        <div className="error-state">
          <Shield size={36} className="error-state-icon" />
          <h3>Sign in required</h3>
          <Button variant="secondary" onClick={() => router.push('/auth/login')}>Sign in</Button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="view-container">
        <div className="error-state">
          <AlertTriangle size={36} className="error-state-icon" />
          <h3>Admin access required</h3>
          <p>This section is only accessible to admin accounts.</p>
        </div>
      </div>
    );
  }

  const filtered = (incidents ?? []).filter(
    (i) => statusFilter === 'all' || i.status === statusFilter,
  );

  const activeCount  = metrics?.active_incidents ?? 0;

  return (
    <div className="view-container admin-view">
      <PageHeader
        eyebrow="Admin"
        title="Command center"
        subtitle="Active incidents, system health, and recent audit activity. All access is logged."
        actions={
          metricsLoading
            ? <Loader2 size={18} className="spin" style={{ color: 'var(--muted)' }} />
            : activeCount > 0
              ? <Badge tone="danger" icon={<Activity size={13} />}>{activeCount} active</Badge>
              : <Badge tone="ok" icon={<CheckCircle2 size={13} />}>No active incidents</Badge>
        }
      />

      <div className="admin-metrics-row">
        {[
          { icon: <Siren size={22} />,    label: 'Active incidents',   value: metrics?.active_incidents, total: metrics?.total_incidents, tone: 'danger' },
          { icon: <Users size={22} />,    label: 'Total users',        value: metrics?.total_users,      tone: 'info' },
          { icon: <FileVideo size={22} />,label: 'Evidence items',     value: metrics?.total_evidence,   tone: 'teal' },
          { icon: <Shield size={22} />,   label: 'Safe places',        value: metrics?.total_safe_places, tone: 'ok' },
        ].map((m, i) => (
          <motion.div
            key={m.label}
            className="admin-metric-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <div className={`admin-metric-icon tone-${m.tone}`}>{m.icon}</div>
            <div>
              <p className="admin-metric-value">
                {metricsLoading ? <span className="skeleton" style={{ width: 32, height: 22, display: 'inline-block', borderRadius: 4 }} /> : (m.value ?? '—')}
              </p>
              <p className="admin-metric-label">{m.label}</p>
              {m.total != null && m.value !== m.total && (
                <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>of {m.total} total</p>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="admin-body">
        <div className="admin-main">
          <AdminMapPreview incidents={incidents ?? []} />

          <div className="admin-table-header">
            <h2 className="section-title">Incidents</h2>
            <div className="admin-filters">
              {(['all', 'active', 'resolved'] as StatusFilter[]).map((f) => (
                <button
                  key={f}
                  className={`filter-tab ${statusFilter === f ? 'is-active' : ''}`}
                  onClick={() => setStatusFilter(f)}
                  type="button"
                >
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  {f === 'all' && incidents && ` (${incidents.length})`}
                </button>
              ))}
            </div>
          </div>

          {incidentsLoading ? (
            <IncidentTableSkeleton />
          ) : error ? (
            <div className="error-state">
              <AlertTriangle size={28} className="error-state-icon" />
              <h3>Could not load incidents</h3>
              <p>{error.message}</p>
              <Button variant="secondary" size="sm" onClick={refresh}>Retry</Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="error-state" style={{ paddingBlock: 32 }}>
              <CheckCircle2 size={28} style={{ color: 'var(--muted)' }} />
              <h3>No incidents</h3>
            </div>
          ) : (
            <div className="admin-table">
              <div className="admin-table-head">
                <span>Status</span>
                <span>ID</span>
                <span>User</span>
                <span>Elapsed</span>
                <span>Alerts / Acks</span>
                <span>Evidence</span>
                <span />
              </div>
              <AnimatePresence>
                {filtered.map((incident, i) => (
                  <AdminIncidentRow key={incident.id} incident={incident} index={i} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="admin-side">
          <Panel eyebrow="System health" icon={<TrendingUp size={20} />} title="Overview">
            <MetricRow
              icon={<Activity size={22} />}
              label="Backend"
              tone={metrics?.db_status === 'ok' ? 'ok' : 'warn'}
              value={metrics?.db_status === 'ok' ? 'Online' : 'Degraded'}
            />
            <MetricRow
              icon={<Shield size={22} />}
              label="Incidents total"
              tone="info"
              value={metrics ? String(metrics.total_incidents) : '…'}
            />
            <MetricRow
              icon={<Clock3 size={22} />}
              label="Active now"
              tone={activeCount > 0 ? 'danger' : 'ok'}
              value={activeCount > 0 ? String(activeCount) : 'None'}
            />
          </Panel>

          <Link href="/admin/audit" className="btn btn-sm btn-ghost" style={{ justifyContent: 'flex-start', gap: 8 }}>
            <List size={15} />
            View audit log
          </Link>
          <Link href="/admin/safe-places" className="btn btn-sm btn-ghost" style={{ justifyContent: 'flex-start', gap: 8 }}>
            <MapPin size={15} />
            Manage safe places
          </Link>

          <div className="admin-access-notice">
            <Eye size={14} />
            <p>This page access has been recorded in the audit log. Minimize access to only what is necessary.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function AdminMapPreview({ incidents }: { incidents: AdminIncident[] }) {
  const active = incidents.filter((i) => i.status === 'active');
  return (
    <div className="admin-map-preview">
      <div className="admin-map-grid" aria-hidden />
      {active.slice(0, 5).map((inc, i) => {
        const angle = (i * 72) * (Math.PI / 180);
        const x = 50 + 28 * Math.cos(angle);
        const y = 50 + 22 * Math.sin(angle);
        return (
          <div
            key={inc.id}
            className="admin-map-dot dot-active"
            style={{ left: `${x}%`, top: `${y}%` }}
            aria-hidden="true"
          />
        );
      })}
      <div className="admin-map-label">
        <Activity size={13} /> Live incident map — approximate areas only
      </div>
    </div>
  );
}

function AdminIncidentRow({ incident, index }: { incident: AdminIncident; index: number }) {
  return (
    <motion.div
      className="admin-table-row"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ delay: index * 0.05 }}
    >
      <span><StatusPill status={incident.status} /></span>
      <span className="incident-id">{incident.id.slice(0, 8).toUpperCase()}</span>
      <span className="incident-area">{incident.user_display_name}</span>
      <span className="table-muted">{formatElapsed(incident.elapsed_seconds)}</span>
      <span>{incident.witness_alert_count} / {incident.witness_ack_count}</span>
      <span>{incident.evidence_count}</span>
      <span>
        <Link
          href={`/admin/incidents/${incident.id}`}
          className="table-view-btn"
          aria-label={`View incident ${incident.id.slice(0, 8)}`}
        >
          <Eye size={15} />
          <ChevronRight size={14} />
        </Link>
      </span>
    </motion.div>
  );
}

function StatusPill({ status }: { status: IncidentStatus }) {
  if (status === 'active') return <Badge tone="danger" icon={<Activity size={12} />}>Active</Badge>;
  return <Badge tone="ok" icon={<CheckCircle2 size={12} />}>Resolved</Badge>;
}

function IncidentTableSkeleton() {
  return (
    <div className="admin-table">
      <div className="admin-table-head">
        <span>Status</span><span>ID</span><span>User</span>
        <span>Elapsed</span><span>Alerts / Acks</span><span>Evidence</span><span />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="admin-table-row" aria-hidden>
          <div className="skeleton" style={{ width: 72, height: 22, borderRadius: 12 }} />
          <div className="skeleton skeleton-text" style={{ width: 64 }} />
          <div className="skeleton skeleton-text" style={{ width: 100 }} />
          <div className="skeleton skeleton-text" style={{ width: 48 }} />
          <div className="skeleton skeleton-text" style={{ width: 40 }} />
          <div className="skeleton skeleton-text" style={{ width: 20 }} />
          <div />
        </div>
      ))}
    </div>
  );
}
