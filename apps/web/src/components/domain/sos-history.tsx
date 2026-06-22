'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, CheckCircle2, Clock3, FileVideo, History,
  Siren, Users,
} from 'lucide-react';
import Link from 'next/link';
import { sosApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useQuery, formatElapsed } from '@/lib/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import type { Incident } from '@/lib/types';

export function SOSHistoryView() {
  const { isAuthenticated } = useAuth();

  const { data: incidents, isLoading, error, refresh } = useQuery(
    () => isAuthenticated ? sosApi.getHistory() : Promise.resolve([]),
    [isAuthenticated],
    { enabled: isAuthenticated },
  );

  const activeCount   = (incidents ?? []).filter((i) => i.status === 'active').length;
  const resolvedCount = (incidents ?? []).filter((i) => i.status === 'resolved').length;

  return (
    <div className="view-container sos-history-view">
      <PageHeader
        eyebrow="SOS"
        title="Incident history"
        subtitle="Your past SOS incidents with evidence and witness counts. All records are retained."
        actions={
          <Link href="/sos/active" className="btn btn-sm btn-ghost">
            <Siren size={14} />
            Start new SOS
          </Link>
        }
      />

      {incidents && incidents.length > 0 && (
        <div className="history-summary-row">
          <div className="history-summary-chip">
            <Siren size={14} /> {activeCount} active
          </div>
          <div className="history-summary-chip resolved">
            <CheckCircle2 size={14} /> {resolvedCount} resolved
          </div>
          <div className="history-summary-chip total">
            <History size={14} /> {incidents.length} total
          </div>
        </div>
      )}

      {isLoading ? (
        <HistorySkeleton />
      ) : error ? (
        <div className="error-state">
          <AlertTriangle size={32} className="error-state-icon" />
          <h3>Could not load history</h3>
          <p>{error.message}</p>
          <Button variant="secondary" onClick={refresh}>Try again</Button>
        </div>
      ) : (incidents ?? []).length === 0 ? (
        <div className="error-state">
          <History size={40} style={{ color: 'var(--muted)' }} />
          <h3>No incidents yet</h3>
          <p>Your SOS history will appear here after you trigger your first incident.</p>
          <Link href="/sos/active">
            <Button variant="secondary" icon={<Siren size={15} />}>
              Go to SOS
            </Button>
          </Link>
        </div>
      ) : (
        <div className="history-list">
          <AnimatePresence>
            {(incidents ?? []).map((incident, i) => (
              <HistoryRow key={incident.id} incident={incident} index={i} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="sos-safety-notice" style={{ marginTop: 8 }}>
        <AlertTriangle size={14} />
        <p>
          Incident records and evidence hashes are retained indefinitely. Evidence files may be
          deleted but hash records remain for integrity verification.
        </p>
      </div>
    </div>
  );
}

function HistoryRow({ incident, index }: { incident: Incident; index: number }) {
  const createdDate = new Date(incident.created_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  const createdTime = new Date(incident.created_at).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <motion.div
      className={`history-row status-${incident.status}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ delay: index * 0.05 }}
    >
      <div className={`history-status-dot dot-${incident.status}`} aria-hidden />
      <div className="history-row-body">
        <div className="history-row-header">
          <span className="history-incident-id">{incident.id.slice(0, 8).toUpperCase()}</span>
          {incident.status === 'active'
            ? <Badge tone="danger" icon={<Siren size={11} />}>Active</Badge>
            : <Badge tone="ok" icon={<CheckCircle2 size={11} />}>Resolved</Badge>}
        </div>
        <div className="history-row-meta">
          <span className="history-date"><Clock3 size={12} /> {createdDate} at {createdTime}</span>
          <span className="history-chip"><Users size={12} /> {incident.witness_alert_count} alerted</span>
          <span className="history-chip"><FileVideo size={12} /> {incident.evidence_count} evidence</span>
          <span className="history-chip">
            <Clock3 size={12} /> {formatElapsed(incident.elapsed_seconds)}
          </span>
        </div>
      </div>
      {incident.status === 'active' && (
        <Link href="/sos/active" className="btn btn-sm btn-ghost">
          View
        </Link>
      )}
    </motion.div>
  );
}

function HistorySkeleton() {
  return (
    <div className="history-list">
      {[0, 1, 2].map((i) => (
        <div key={i} className="history-row" aria-hidden>
          <div className="skeleton" style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton skeleton-text" style={{ width: '40%' }} />
            <div className="skeleton skeleton-text sm" style={{ width: '65%', marginTop: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
