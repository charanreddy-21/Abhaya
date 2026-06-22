'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Siren, Users, FileVideo, Shield, Clock3,
  CheckCircle2, AlertTriangle, Activity, Filter,
  TrendingUp, Eye, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Panel } from '@/components/ui/panel';
import { PageHeader } from '@/components/ui/page-header';
import { MetricRow } from '@/components/ui/metric-row';

type IncidentStatus = 'active' | 'acknowledged' | 'resolved' | 'expired';

interface AdminIncident {
  id: string;
  displayId: string;
  status: IncidentStatus;
  area: string;
  createdAt: string;
  elapsed: string;
  witnessAlerts: number;
  witnessAcks: number;
  evidenceCount: number;
  lastEvent: string;
}

const MOCK_INCIDENTS: AdminIncident[] = [
  {
    id: 'inc_1204',
    displayId: '#1204',
    status: 'active',
    area: 'Koramangala, Bengaluru',
    createdAt: 'Today 14:32',
    elapsed: '8 min',
    witnessAlerts: 3,
    witnessAcks: 1,
    evidenceCount: 2,
    lastEvent: 'Witness acknowledged',
  },
  {
    id: 'inc_1203',
    displayId: '#1203',
    status: 'acknowledged',
    area: 'Indiranagar, Bengaluru',
    createdAt: 'Today 11:04',
    elapsed: '3 h 36 min',
    witnessAlerts: 5,
    witnessAcks: 3,
    evidenceCount: 1,
    lastEvent: 'Evidence uploaded',
  },
  {
    id: 'inc_1202',
    displayId: '#1202',
    status: 'resolved',
    area: 'BTM Layout, Bengaluru',
    createdAt: 'Yesterday 22:18',
    elapsed: '15 min',
    witnessAlerts: 2,
    witnessAcks: 2,
    evidenceCount: 3,
    lastEvent: 'Resolved by user',
  },
  {
    id: 'inc_1201',
    displayId: '#1201',
    status: 'expired',
    area: 'HSR Layout, Bengaluru',
    createdAt: 'Jun 20 08:44',
    elapsed: '—',
    witnessAlerts: 1,
    witnessAcks: 0,
    evidenceCount: 0,
    lastEvent: 'Expired — no activity',
  },
  {
    id: 'inc_1200',
    displayId: '#1200',
    status: 'resolved',
    area: 'Whitefield, Bengaluru',
    createdAt: 'Jun 19 16:12',
    elapsed: '22 min',
    witnessAlerts: 4,
    witnessAcks: 4,
    evidenceCount: 2,
    lastEvent: 'Resolved by admin',
  },
];

export function AdminCommandCenter() {
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'all'>('all');

  const filtered = MOCK_INCIDENTS.filter(i => statusFilter === 'all' || i.status === statusFilter);
  const activeCount = MOCK_INCIDENTS.filter(i => i.status === 'active').length;
  const ackCount = MOCK_INCIDENTS.filter(i => i.status === 'acknowledged').length;

  return (
    <div className="view-container admin-view">
      <PageHeader
        eyebrow="Admin"
        title="Command center"
        subtitle="Active incidents, evidence overview, and safe-place verification."
        actions={
          activeCount > 0
            ? <Badge tone="danger" icon={<Activity size={13} />}>{activeCount} active</Badge>
            : <Badge tone="ok" icon={<CheckCircle2 size={13} />}>No active incidents</Badge>
        }
      />

      <div className="admin-metrics-row">
        {[
          { icon: <Siren size={22} />, label: 'Active incidents', value: String(activeCount), tone: 'danger' },
          { icon: <Users size={22} />, label: 'Acknowledged', value: String(ackCount), tone: 'warn' },
          { icon: <FileVideo size={22} />, label: 'Evidence items', value: '8', tone: 'info' },
          { icon: <Shield size={22} />, label: 'Verified safe places', value: '12', tone: 'ok' },
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
              <p className="admin-metric-value">{m.value}</p>
              <p className="admin-metric-label">{m.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="admin-body">
        <div className="admin-main">
          <AdminMapPreview />

          <div className="admin-table-header">
            <h2 className="section-title">Incidents</h2>
            <div className="admin-filters">
              {(['all', 'active', 'acknowledged', 'resolved', 'expired'] as const).map(f => (
                <button
                  key={f}
                  className={`filter-tab ${statusFilter === f ? 'is-active' : ''}`}
                  onClick={() => setStatusFilter(f)}
                  type="button"
                >
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="admin-table">
            <div className="admin-table-head">
              <span>Status</span>
              <span>ID</span>
              <span>Area</span>
              <span>Created</span>
              <span>Elapsed</span>
              <span>Alerts / Acks</span>
              <span>Evidence</span>
              <span>Last event</span>
              <span />
            </div>
            {filtered.map((incident, i) => (
              <AdminIncidentRow key={incident.id} incident={incident} index={i} />
            ))}
          </div>
        </div>

        <div className="admin-side">
          <Panel eyebrow="System health" icon={<TrendingUp size={20} />} title="Overview">
            <MetricRow icon={<Activity size={22} />} label="Backend" tone="ok" value="Online" />
            <MetricRow icon={<Shield size={22} />} label="Spatial engine" tone="ok" value="PostGIS" />
            <MetricRow icon={<Clock3 size={22} />} label="Uptime" tone="info" value="99.8%" />
          </Panel>

          <Panel eyebrow="Recent audit" icon={<Eye size={20} />} title="Admin log">
            <div className="audit-log">
              {[
                { action: 'Viewed incident #1204', time: '14:38', actor: 'admin@abhaya.in' },
                { action: 'Verified safe place #SP-44', time: '13:22', actor: 'admin@abhaya.in' },
                { action: 'Accessed evidence #e2', time: '11:10', actor: 'admin@abhaya.in' },
              ].map((entry, i) => (
                <div key={i} className="audit-row">
                  <div className="audit-dot" />
                  <div>
                    <p className="audit-action">{entry.action}</p>
                    <p className="audit-meta">{entry.actor} · {entry.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function AdminMapPreview() {
  return (
    <div className="admin-map-preview">
      <div className="admin-map-grid" />
      {[
        { x: '38%', y: '42%', status: 'active' },
        { x: '62%', y: '30%', status: 'acknowledged' },
        { x: '24%', y: '58%', status: 'resolved' },
      ].map((dot, i) => (
        <div
          key={i}
          className={`admin-map-dot dot-${dot.status}`}
          style={{ left: dot.x, top: dot.y }}
          aria-hidden="true"
        />
      ))}
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
      transition={{ delay: index * 0.06 }}
    >
      <span><StatusPill status={incident.status} /></span>
      <span className="incident-id">{incident.displayId}</span>
      <span className="incident-area">{incident.area}</span>
      <span className="table-muted">{incident.createdAt}</span>
      <span className="table-muted">{incident.elapsed}</span>
      <span>{incident.witnessAlerts} / {incident.witnessAcks}</span>
      <span>{incident.evidenceCount}</span>
      <span className="table-muted">{incident.lastEvent}</span>
      <span>
        <Link href={`/admin/incidents/${incident.id}`} className="table-view-btn" aria-label={`View incident ${incident.displayId}`}>
          <Eye size={15} />
          <ChevronRight size={14} />
        </Link>
      </span>
    </motion.div>
  );
}

function StatusPill({ status }: { status: IncidentStatus }) {
  if (status === 'active') return <Badge tone="danger" icon={<Activity size={12} />}>Active</Badge>;
  if (status === 'acknowledged') return <Badge tone="warn" icon={<CheckCircle2 size={12} />}>Acknowledged</Badge>;
  if (status === 'resolved') return <Badge tone="ok" icon={<CheckCircle2 size={12} />}>Resolved</Badge>;
  return <Badge tone="neutral">Expired</Badge>;
}
