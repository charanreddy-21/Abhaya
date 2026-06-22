'use client';

import { motion } from 'framer-motion';
import {
  Siren, Users, FileVideo, Shield, Clock3, MapPin,
  CheckCircle2, AlertTriangle, Activity, Eye, Hash,
  LockKeyhole, ChevronLeft, User,
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { MetricRow } from '@/components/ui/metric-row';

const MOCK_INCIDENT = {
  id: 'inc_1204',
  displayId: '#1204',
  status: 'active' as const,
  area: 'Koramangala, Bengaluru',
  createdAt: 'Today 14:32',
  elapsed: '8 min',
  accuracyMeters: 68,
  witnessAlerts: 3,
  witnessAcks: 1,
  evidenceCount: 2,
};

const MOCK_EVIDENCE = [
  { id: 'e1', kind: 'video', label: 'Screen recording', size: '18.4 MB', hash: 'sha256:3e1a…f99d', anchored: true },
  { id: 'e2', kind: 'audio', label: 'Mic capture', size: '4.1 MB', hash: 'sha256:7fa2…c301', anchored: false },
];

const MOCK_WITNESSES = [
  { id: 'w1', label: 'Witness A', status: 'acknowledged', distance: '~120 m', revealed: false },
  { id: 'w2', label: 'Witness B', status: 'alerted', distance: '~240 m', revealed: false },
  { id: 'w3', label: 'Witness C', status: 'pending', distance: '~290 m', revealed: false },
];

const MOCK_TIMELINE = [
  { time: '14:32:00', label: 'SOS created', tone: 'danger', actor: 'User' },
  { time: '14:32:04', label: 'Location locked — 68 m accuracy', tone: 'ok', actor: 'System' },
  { time: '14:32:08', label: '3 nearby witnesses queried', tone: 'info', actor: 'System' },
  { time: '14:32:12', label: 'Evidence recording started', tone: 'info', actor: 'System' },
  { time: '14:32:18', label: 'Witness A acknowledged alert', tone: 'ok', actor: 'Witness A' },
  { time: '14:38:01', label: 'Admin viewed incident', tone: 'neutral', actor: 'admin@abhaya.in' },
];

export function AdminIncidentDetail({ incidentId }: { incidentId: string }) {
  return (
    <div className="view-container admin-detail-view">
      <div className="admin-detail-header">
        <Link href="/admin" className="back-link">
          <ChevronLeft size={18} />
          Back to command center
        </Link>
        <div className="admin-detail-title-row">
          <div>
            <p className="eyebrow">Incident {MOCK_INCIDENT.displayId}</p>
            <h1 className="page-title">{MOCK_INCIDENT.area}</h1>
          </div>
          <div className="admin-detail-actions">
            <Badge tone="danger" icon={<Activity size={13} />}>Active</Badge>
            <Button variant="secondary">Resolve incident</Button>
          </div>
        </div>
      </div>

      <div className="admin-detail-metrics">
        {[
          { icon: <Clock3 size={20} />, label: 'Elapsed', value: MOCK_INCIDENT.elapsed, tone: 'warn' },
          { icon: <MapPin size={20} />, label: 'Location accuracy', value: `~${MOCK_INCIDENT.accuracyMeters} m`, tone: 'ok' },
          { icon: <Users size={20} />, label: 'Alerts / Acks', value: `${MOCK_INCIDENT.witnessAlerts} / ${MOCK_INCIDENT.witnessAcks}`, tone: 'info' },
          { icon: <FileVideo size={20} />, label: 'Evidence items', value: String(MOCK_INCIDENT.evidenceCount), tone: 'info' },
        ].map((m, i) => (
          <motion.div
            key={m.label}
            className="admin-metric-card"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
          >
            <div className={`admin-metric-icon tone-${m.tone}`}>{m.icon}</div>
            <div>
              <p className="admin-metric-value">{m.value}</p>
              <p className="admin-metric-label">{m.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="admin-detail-grid">
        <div className="admin-detail-main">
          <IncidentMapDetail />
          <EvidenceSection evidence={MOCK_EVIDENCE} />
        </div>
        <div className="admin-detail-side">
          <WitnessSection witnesses={MOCK_WITNESSES} />
          <TimelineSection events={MOCK_TIMELINE} />
          <AdminAccessNotice />
        </div>
      </div>
    </div>
  );
}

function IncidentMapDetail() {
  return (
    <Panel eyebrow="Location" icon={<MapPin size={18} />} title="Approximate incident area">
      <div className="detail-map-zone">
        <div className="detail-map-grid" />
        <div className="detail-zone-ring" />
        <div className="detail-epicenter">
          <Siren size={16} />
        </div>
        <div className="detail-map-label">
          Exact coordinates are not shown to protect user privacy. Approximate zone displayed.
        </div>
      </div>
    </Panel>
  );
}

function EvidenceSection({ evidence }: { evidence: typeof MOCK_EVIDENCE }) {
  return (
    <Panel eyebrow="Evidence" icon={<LockKeyhole size={18} />} title="Captured evidence">
      <div className="admin-evidence-list">
        {evidence.map((item, i) => (
          <motion.div
            key={item.id}
            className="admin-evidence-row"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className={`evidence-kind-icon kind-${item.kind}`}>
              <FileVideo size={17} />
            </div>
            <div className="admin-evidence-info">
              <p className="evidence-label-sm">{item.label}</p>
              <div className="evidence-hash-row-sm">
                <Hash size={12} />
                <span>{item.hash}</span>
                {item.anchored
                  ? <Badge tone="ok" icon={<CheckCircle2 size={11} />}>Anchored</Badge>
                  : <Badge tone="info">Hashed</Badge>}
              </div>
            </div>
            <span className="evidence-size">{item.size}</span>
          </motion.div>
        ))}
      </div>
      <p className="panel-footnote">Admin access to evidence is audited. Raw files require explicit authorization.</p>
    </Panel>
  );
}

function WitnessSection({ witnesses }: { witnesses: typeof MOCK_WITNESSES }) {
  return (
    <Panel eyebrow="Witness alerts" icon={<Users size={18} />} title="Nearby witnesses">
      <div className="witness-list">
        {witnesses.map((w, i) => (
          <div key={w.id} className={`witness-row status-${w.status}`}>
            <div className="witness-avatar">
              <User size={14} />
            </div>
            <div className="witness-info">
              <span className="witness-label">{w.label}</span>
              <span className="witness-meta">{w.distance}</span>
            </div>
            <Badge
              tone={w.status === 'acknowledged' ? 'ok' : w.status === 'alerted' ? 'info' : 'neutral'}
            >
              {w.status === 'acknowledged' ? 'Acked' : w.status === 'alerted' ? 'Alerted' : 'Pending'}
            </Badge>
          </div>
        ))}
      </div>
      <p className="panel-footnote">Identities are hidden unless witnesses reveal themselves.</p>
    </Panel>
  );
}

function TimelineSection({ events }: { events: typeof MOCK_TIMELINE }) {
  return (
    <Panel eyebrow="Audit trail" icon={<Clock3 size={18} />} title="Incident timeline">
      <div className="incident-timeline">
        {events.map((ev, i) => (
          <motion.div
            key={i}
            className={`timeline-row tone-${ev.tone}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
          >
            <span className="timeline-time">{ev.time}</span>
            <div className="timeline-line" />
            <div>
              <span className="timeline-label">{ev.label}</span>
              <span className="timeline-actor">{ev.actor}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </Panel>
  );
}

function AdminAccessNotice() {
  return (
    <div className="admin-access-notice">
      <Eye size={14} />
      <p>This page access has been recorded in the audit log. Minimize access to only what is necessary.</p>
    </div>
  );
}
