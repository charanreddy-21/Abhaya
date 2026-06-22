'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Activity, AlertTriangle, CheckCircle2, ChevronLeft, Clock3,
  Eye, FileAudio, FileVideo, Hash, Image as ImageIcon, Loader2,
  LockKeyhole, MapPin, Siren, User, Users,
} from 'lucide-react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import { useQuery, useMutation, formatElapsed } from '@/lib/hooks';
import { AbhayaApiError } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { MetricRow } from '@/components/ui/metric-row';
import type {
  AdminEvidence, AdminWitness, AdminAuditEvent,
  AdminIncident, EvidenceKind, WitnessAlertStatus,
} from '@/lib/types';

interface Props { incidentId: string }

export function AdminIncidentDetail({ incidentId }: Props) {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const {
    data: detail, isLoading, error, refresh,
  } = useQuery(() => adminApi.getIncident(incidentId), [incidentId]);

  const { mutate: doResolve, isLoading: resolving } = useMutation(
    (id: string) => adminApi.resolveIncident(id),
  );

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

  if (isLoading) return <IncidentDetailSkeleton />;

  if (error || !detail) {
    return (
      <div className="view-container">
        <div className="error-state">
          <AlertTriangle size={32} className="error-state-icon" />
          <h3>Incident not found</h3>
          <p>{error?.message ?? 'This incident could not be loaded.'}</p>
          <Button variant="secondary" onClick={() => router.push('/admin')}>
            Back to command center
          </Button>
        </div>
      </div>
    );
  }

  const { incident, witnesses, evidence, timeline } = detail;

  async function handleResolve() {
    try {
      await doResolve(incidentId);
      toast('Incident marked resolved. Audit event recorded.', 'ok');
      refresh();
    } catch (err) {
      toast(err instanceof AbhayaApiError ? err.message : 'Could not resolve incident.', 'warn');
    }
  }

  return (
    <div className="view-container admin-detail-view">
      <div className="admin-detail-header">
        <Link href="/admin" className="back-link">
          <ChevronLeft size={18} />
          Command center
        </Link>
        <div className="admin-detail-title-row">
          <div>
            <p className="eyebrow">Incident {incident.id.slice(0, 8).toUpperCase()}</p>
            <h1 className="page-title">{incident.user_display_name}</h1>
          </div>
          <div className="admin-detail-actions">
            <StatusBadge status={incident.status} />
            {incident.status === 'active' && (
              <Button
                variant="secondary"
                icon={resolving ? <Loader2 size={15} className="spin" /> : <CheckCircle2 size={15} />}
                onClick={handleResolve}
                disabled={resolving}
              >
                Resolve incident
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="admin-detail-metrics">
        {[
          { icon: <Clock3 size={20} />,  label: 'Elapsed',           value: formatElapsed(incident.elapsed_seconds), tone: 'warn' },
          { icon: <MapPin size={20} />,  label: 'Location accuracy', value: `~${incident.accuracy_meters} m`,         tone: 'ok'   },
          { icon: <Users size={20} />,   label: 'Alerts / Acks',     value: `${incident.witness_alert_count} / ${incident.witness_ack_count}`, tone: 'info' },
          { icon: <FileVideo size={20} />, label: 'Evidence items',  value: String(incident.evidence_count),          tone: 'teal' },
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
          <EvidenceSection evidence={evidence} />
        </div>
        <div className="admin-detail-side">
          <WitnessSection witnesses={witnesses} />
          <TimelineSection events={timeline} />
          <AdminAccessNotice />
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function IncidentMapDetail() {
  return (
    <Panel eyebrow="Location" icon={<MapPin size={18} />} title="Approximate incident area">
      <div className="detail-map-zone">
        <div className="detail-map-grid" aria-hidden />
        <div className="detail-zone-ring" aria-hidden />
        <div className="detail-epicenter" aria-hidden>
          <Siren size={16} />
        </div>
        <p className="detail-map-label">
          Exact coordinates are not shown to protect user privacy. Approximate zone displayed.
        </p>
      </div>
    </Panel>
  );
}

function EvidenceSection({ evidence }: { evidence: AdminEvidence[] }) {
  if (evidence.length === 0) {
    return (
      <Panel eyebrow="Evidence" icon={<LockKeyhole size={18} />} title="Captured evidence">
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>No evidence attached to this incident.</p>
      </Panel>
    );
  }
  return (
    <Panel eyebrow="Evidence" icon={<LockKeyhole size={18} />} title={`Evidence (${evidence.length})`}>
      <div className="admin-evidence-list">
        {evidence.map((item, i) => (
          <motion.div
            key={item.id}
            className="admin-evidence-row"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.09 }}
          >
            <div className={`evidence-kind-icon kind-${item.kind}`}>
              <EvidenceKindIcon kind={item.kind} />
            </div>
            <div className="admin-evidence-info">
              <p className="evidence-label-sm">{item.label}</p>
              <div className="evidence-hash-row-sm">
                <Hash size={11} />
                <span>{item.sha256_hash.slice(0, 20)}…</span>
                {item.anchored
                  ? <Badge tone="ok" icon={<CheckCircle2 size={11} />}>Anchored</Badge>
                  : <Badge tone="info">Hashed</Badge>}
              </div>
            </div>
            <span className="evidence-size">{formatBytes(item.size_bytes)}</span>
          </motion.div>
        ))}
      </div>
      <p className="panel-footnote">Admin access to evidence is audited. Raw files require explicit authorization.</p>
    </Panel>
  );
}

function WitnessSection({ witnesses }: { witnesses: AdminWitness[] }) {
  return (
    <Panel eyebrow="Witness alerts" icon={<Users size={18} />} title={`Witnesses (${witnesses.length})`}>
      {witnesses.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>No witnesses were alerted.</p>
      ) : (
        <div className="witness-list">
          {witnesses.map((w) => (
            <div key={w.id} className={`witness-row status-${w.status}`}>
              <div className="witness-avatar"><User size={14} /></div>
              <div className="witness-info">
                <span className="witness-label">
                  {w.revealed && w.display_name ? w.display_name : w.label}
                </span>
                <span className="witness-meta">~{w.approx_distance_meters} m</span>
              </div>
              <WitnessStatusBadge status={w.status} />
            </div>
          ))}
        </div>
      )}
      <p className="panel-footnote">Identities are hidden unless witnesses reveal themselves.</p>
    </Panel>
  );
}

function TimelineSection({ events }: { events: AdminAuditEvent[] }) {
  return (
    <Panel eyebrow="Audit trail" icon={<Clock3 size={18} />} title="Incident timeline">
      {events.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>No audit events yet.</p>
      ) : (
        <div className="incident-timeline">
          {events.map((ev, i) => (
            <motion.div
              key={ev.id}
              className="timeline-row"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <span className="timeline-time">
                {new Date(ev.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <div className="timeline-line" />
              <div>
                <span className="timeline-label">{ev.action}</span>
                <span className="timeline-actor">{ev.actor_label}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function AdminAccessNotice() {
  return (
    <div className="admin-access-notice">
      <Eye size={14} />
      <p>This page view has been recorded in the audit log. Minimize access to only what is necessary.</p>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') return <Badge tone="danger" icon={<Activity size={12} />}>Active</Badge>;
  return <Badge tone="ok" icon={<CheckCircle2 size={12} />}>Resolved</Badge>;
}

function WitnessStatusBadge({ status }: { status: WitnessAlertStatus }) {
  if (status === 'acknowledged') return <Badge tone="ok">Acked</Badge>;
  if (status === 'revealed')     return <Badge tone="ok">ID shared</Badge>;
  if (status === 'alerted')      return <Badge tone="info">Alerted</Badge>;
  return <Badge tone="neutral">Pending</Badge>;
}

function EvidenceKindIcon({ kind }: { kind: EvidenceKind }) {
  if (kind === 'video') return <FileVideo size={17} />;
  if (kind === 'audio') return <FileAudio size={17} />;
  return <ImageIcon size={17} />;
}

function formatBytes(bytes: number): string {
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function IncidentDetailSkeleton() {
  return (
    <div className="view-container admin-detail-view">
      <div className="admin-detail-header">
        <div className="skeleton skeleton-text" style={{ width: 120 }} />
        <div className="skeleton skeleton-text" style={{ width: 200, height: 28, marginTop: 8 }} />
      </div>
      <div className="admin-detail-metrics">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="admin-metric-card" aria-hidden>
            <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 8 }} />
            <div>
              <div className="skeleton skeleton-text" style={{ width: 48 }} />
              <div className="skeleton skeleton-text sm" style={{ width: 80, marginTop: 4 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
