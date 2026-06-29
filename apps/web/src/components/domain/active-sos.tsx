'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, AlertTriangle, CheckCircle2, Clock3, FileVideo,
  Loader2, MapPin, Mic, Radio, Shield, Siren, Users, WifiOff, X,
} from 'lucide-react';
import { sosApi, witnessApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import { useGeolocation, useElapsedSeconds, useOnlineStatus, formatElapsed } from '@/lib/hooks';
import { AbhayaApiError, NetworkError } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import SmsFallback from './sms-fallback';
import {
  enqueuePendingSOS,
  getPendingSOS,
  clearPendingSOS,
  isPendingSOSStale,
} from '@/lib/offline-queue';
import type { Incident, WitnessAlert } from '@/lib/types';

export function ActiveSOSView() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const geo = useGeolocation();
  const isOnline = useOnlineStatus();

  const [incident, setIncident]     = useState<Incident | null>(null);
  const [witnesses, setWitnesses]   = useState<WitnessAlert[]>([]);
  const [creating, setCreating]     = useState(false);
  const [resolving, setResolving]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [phase, setPhase]           = useState<'idle' | 'arming' | 'pending' | 'active' | 'resolved'>('idle');

  const retryRef = useRef(false);
  const elapsed  = useElapsedSeconds(incident?.created_at ?? null);

  useEffect(() => {
    if (!isAuthenticated) router.push('/auth/login');
  }, [isAuthenticated, router]);

  // On mount: check for a stale pending SOS from a previous session
  useEffect(() => {
    const pending = getPendingSOS();
    if (!pending) return;
    if (isPendingSOSStale(pending)) {
      clearPendingSOS();
      return;
    }
    setPhase('pending');
    setError('SOS was queued while offline. It will send automatically when the network returns.');
  }, []);

  // Auto-retry pending SOS when the network comes back
  useEffect(() => {
    if (!isOnline || phase !== 'pending' || retryRef.current) return;
    const pending = getPendingSOS();
    if (!pending) { setPhase('idle'); setError(null); return; }

    retryRef.current = true;
    setCreating(true);
    sosApi.create(pending.payload)
      .then((inc) => {
        clearPendingSOS();
        setIncident(inc);
        setPhase('active');
        setError(null);
        toast('SOS sent. Nearby opted-in witnesses are being alerted.', 'danger', 6000);
      })
      .catch((err) => {
        const msg = err instanceof AbhayaApiError ? err.message
          : 'Retry failed. Keep this screen open — Abhaya will try again.';
        setError(msg);
        retryRef.current = false;
      })
      .finally(() => setCreating(false));
  }, [isOnline, phase, toast]);

  // Poll witnesses while active
  useEffect(() => {
    if (!incident || incident.status !== 'active') return;
    const poll = async () => {
      try {
        const alerts = await witnessApi.listAlerts();
        setWitnesses(alerts.filter((a) => a.incident_id === incident.id));
      } catch { /* non-fatal */ }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [incident]);

  const handleAction = useCallback(async () => {
    if (phase === 'idle') {
      setPhase('arming');
      geo.request();
      toast('Tap again to confirm SOS. Location is being acquired.', 'warn', 3500);
      return;
    }
    if (phase !== 'arming') return;

    setCreating(true);
    setError(null);

    const payload = {
      lat:             geo.position?.latitude  ?? 12.9352,
      lng:             geo.position?.longitude ?? 77.6245,
      accuracy_meters: geo.position?.accuracy  ?? 999,
    };

    try {
      const inc = await sosApi.create(payload);
      setIncident(inc);
      setPhase('active');
      toast('SOS active. Nearby opted-in witnesses are being alerted.', 'danger', 6000);
    } catch (err) {
      if (err instanceof NetworkError) {
        enqueuePendingSOS(payload);
        setPhase('pending');
        const msg = 'Server unreachable. SOS is queued locally and will send when the network returns.';
        setError(msg);
        toast(msg, 'warn', 8000);
      } else {
        const msg = err instanceof AbhayaApiError ? err.message : 'Could not start SOS. Please try again.';
        setError(msg);
        setPhase('idle');
        toast(msg, 'warn');
      }
    } finally {
      setCreating(false);
    }
  }, [phase, geo, toast]);

  async function resolveIncident() {
    if (!incident) return;
    setResolving(true);
    try {
      const resolved = await sosApi.resolve(incident.id);
      setIncident(resolved);
      setPhase('resolved');
      toast('Incident marked resolved. Evidence and records are preserved.', 'ok', 6000);
    } catch (err) {
      toast(err instanceof AbhayaApiError ? err.message : 'Could not resolve. Please try again.', 'warn');
    } finally {
      setResolving(false);
    }
  }

  function reset() {
    clearPendingSOS();
    setIncident(null);
    setWitnesses([]);
    setPhase('idle');
    setError(null);
    retryRef.current = false;
  }

  return (
    <div className="view-container sos-view">
      <SOSHeader phase={phase} elapsed={elapsed} incident={incident} />

      <AnimatePresence mode="wait">
        {phase === 'resolved' ? (
          <ResolvedState key="resolved" incident={incident} onReset={reset} />
        ) : (
          <motion.div
            key="active-layout"
            className="sos-main-grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="sos-left-col">
              <SOSMapZone incident={incident} witnesses={witnesses} geoReady={!!geo.position} />
              <SOSPrimaryAction
                phase={phase}
                creating={creating}
                resolving={resolving}
                error={error}
                onAction={handleAction}
                onResolve={resolveIncident}
                onCancelPending={reset}
              />
            </div>
            <div className="sos-right-col">
              <IncidentStatusBar incident={incident} geoAccuracy={geo.position?.accuracy ?? null} phase={phase} />
              {incident && <WitnessPanel witnesses={witnesses} />}
              <SafetyNotice />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SOSHeader({ phase, elapsed, incident }: {
  phase: string; elapsed: number; incident: Incident | null;
}) {
  const titles: Record<string, string> = {
    idle:     'SOS Ready',
    arming:   'Confirm SOS',
    pending:  'SOS Queued',
    active:   'SOS Active',
    resolved: 'Incident Resolved',
  };
  return (
    <div className="sos-page-header">
      <div className="sos-header-left">
        {(phase === 'active' || phase === 'pending') && <span className="live-dot" aria-hidden />}
        <div>
          <h1 className="page-title" style={{ margin: 0, fontSize: '20px' }}>
            {titles[phase] ?? 'SOS'}
          </h1>
          {incident && (
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
              Incident {incident.id.slice(0, 8).toUpperCase()}
            </p>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {phase === 'active' && (
          <Badge tone="danger" icon={<Clock3 size={13} />}>{formatElapsed(elapsed)}</Badge>
        )}
        {phase === 'pending' && (
          <Badge tone="warn" icon={<WifiOff size={13} />}>Queued offline</Badge>
        )}
        {incident && (
          <>
            <Badge tone="info" icon={<Users size={13} />}>{incident.witness_alert_count} alerted</Badge>
            <Badge tone="info" icon={<FileVideo size={13} />}>{incident.evidence_count} evidence</Badge>
          </>
        )}
      </div>
    </div>
  );
}

function SOSMapZone({ incident, witnesses, geoReady }: {
  incident: Incident | null; witnesses: WitnessAlert[]; geoReady: boolean;
}) {
  return (
    <div className="sos-map-zone" aria-label="Approximate incident zone" role="img">
      <div className="map-grid-bg" aria-hidden />
      {incident && (
        <>
          <div className="sos-ring ring-outer" aria-hidden />
          <div className="sos-ring ring-middle" aria-hidden />
        </>
      )}
      <div className={`sos-epicenter ${incident ? 'is-active' : ''}`} aria-hidden>
        <Siren size={18} />
      </div>
      {witnesses.slice(0, 6).map((w, i) => {
        const angle = (i * 60) * (Math.PI / 180);
        const r = 35;
        const x = 50 + r * Math.cos(angle);
        const y = 50 + r * Math.sin(angle);
        return (
          <div
            key={w.id}
            className={`witness-dot ${w.status === 'acknowledged' || w.status === 'revealed' ? 'is-acked' : ''}`}
            style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', position: 'absolute' }}
            aria-hidden
          />
        );
      })}
      {!geoReady && (
        <div className="map-overlay-notice">
          <MapPin size={13} /> Acquiring location…
        </div>
      )}
    </div>
  );
}

function SOSPrimaryAction({ phase, creating, resolving, error, onAction, onResolve, onCancelPending }: {
  phase: string; creating: boolean; resolving: boolean;
  error: string | null; onAction: () => void; onResolve: () => void; onCancelPending: () => void;
}) {
  return (
    <div className="sos-action-panel">
      {/* Remove the old error notice, SmsFallback handles it now */}
      
      {phase === 'pending' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* REPLACE THE WAITING BUTTON WITH THE SMS FALLBACK */}
          <SmsFallback 
             apiError={{ error: { code: 'NETWORK_ERROR' } }} 
             onRetry={onAction} 
             retrying={creating} 
          />
          
          <button
            className="btn btn-ghost btn-sm"
            onClick={onCancelPending}
            type="button"
          >
            <X size={14} /> Cancel queued SOS
          </button>
        </div>
      ) : phase !== 'active' ? (
        <button
          className={`sos-button ${phase === 'arming' ? 'is-arming' : ''}`}
          onClick={onAction}
          disabled={creating}
          type="button"
          aria-live="polite"
        >
          {creating ? <Loader2 size={28} className="spin" /> : <Siren size={28} />}
          <span>{phase === 'arming' ? 'Tap again to confirm' : 'Start SOS'}</span>
          <small>{phase === 'arming' ? 'Sends alerts to nearby opted-in users' : 'Tap once to arm, again to send'}</small>
        </button>
      ) : (
        <button
          className="sos-button is-active"
          onClick={onResolve}
          disabled={resolving}
          type="button"
          aria-live="polite"
        >
          {resolving ? <Loader2 size={28} className="spin" /> : <CheckCircle2 size={28} />}
          <span>Mark Resolved</span>
          <small>Press when you are safe</small>
        </button>
      )}

      <div className="sos-panel-meta">
        <span><Shield size={15} /> No police dispatch</span>
        <span><Radio size={15} /> Witness alerts only</span>
        <span><Mic size={15} /> Evidence capture</span>
      </div>
    </div>
  );
}

function IncidentStatusBar({ incident, geoAccuracy, phase }: {
  incident: Incident | null; geoAccuracy: number | null; phase: string;
}) {
  const locTone = geoAccuracy == null ? 'warn' : geoAccuracy < 200 ? 'ok' : 'danger';
  const locLabel = geoAccuracy != null
    ? geoAccuracy < 50 ? 'Precise' : `~${Math.round(geoAccuracy)}m accuracy`
    : 'Not acquired';

  return (
    <Panel eyebrow="Status" icon={<Activity size={18} />} title="Incident status">
      <div className="status-chip-row">
        <div className={`status-chip tone-${locTone}`}><MapPin size={13} /> {locLabel}</div>
        <div className={`status-chip tone-${incident ? 'ok' : phase === 'pending' ? 'warn' : 'warn'}`}>
          <Radio size={13} />{' '}
          {incident ? `${incident.witness_alert_count} alerted` : phase === 'pending' ? 'Queued' : 'Standby'}
        </div>
        <div className="status-chip tone-info">
          <FileVideo size={13} /> {incident ? `${incident.evidence_count} items` : 'Ready'}
        </div>
      </div>
    </Panel>
  );
}

function WitnessPanel({ witnesses }: { witnesses: WitnessAlert[] }) {
  if (witnesses.length === 0) {
    return (
      <Panel eyebrow="Witnesses" icon={<Users size={18} />} title="Nearby alerts">
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
          Looking for opted-in witnesses nearby…
        </p>
      </Panel>
    );
  }
  return (
    <Panel eyebrow="Witnesses" icon={<Users size={18} />} title={`${witnesses.length} nearby`}>
      <div className="witness-alert-list">
        {witnesses.map((w, i) => (
          <motion.div
            key={w.id}
            className="witness-alert-row"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <div className={`witness-status-dot status-${w.status}`} />
            <div className="witness-alert-info">
              <span className="witness-label">
                {w.witness_display_name ?? `Witness ${String.fromCharCode(65 + i)}`}
              </span>
              <span className="witness-meta">~{w.approx_distance_meters}m away</span>
            </div>
            <Badge tone={w.status === 'acknowledged' || w.status === 'revealed' ? 'ok' : 'info'}>
              {w.status === 'revealed' ? 'ID shared' : w.status === 'acknowledged' ? 'Acked' : 'Alerted'}
            </Badge>
          </motion.div>
        ))}
      </div>
    </Panel>
  );
}

function SafetyNotice() {
  return (
    <div className="sos-safety-notice">
      <AlertTriangle size={14} />
      <p>
        Abhaya alerts nearby opted-in users only. It does not dispatch police or guarantee
        a response. Call 112 in life-threatening emergencies.
      </p>
    </div>
  );
}

function ResolvedState({ incident, onReset }: { incident: Incident | null; onReset: () => void }) {
  return (
    <motion.div
      className="sos-resolved-state"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="resolved-icon"><CheckCircle2 size={52} /></div>
      <h2>Incident resolved</h2>
      <p>
        {incident
          ? `Incident ${incident.id.slice(0, 8).toUpperCase()} is marked resolved. All records are preserved.`
          : 'The incident has been marked resolved. Stay safe.'}
      </p>
      <Button variant="secondary" onClick={onReset} icon={<X size={16} />}>
        Start new session
      </Button>
    </motion.div>
  );
}
