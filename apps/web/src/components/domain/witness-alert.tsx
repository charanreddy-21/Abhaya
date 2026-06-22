'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Bell, Check, Eye, EyeOff,
  Loader2, MapPin, Shield, Users, X,
} from 'lucide-react';
import { witnessApi, authApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import { useQuery, useMutation } from '@/lib/hooks';
import { AbhayaApiError } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/ui/page-header';
import type { WitnessAlert } from '@/lib/types';

export function WitnessAlertView() {
  const router = useRouter();
  const { user, isAuthenticated, updateUser, refreshUser } = useAuth();
  const { toast } = useToast();
  const [revealModal, setRevealModal] = useState<string | null>(null);

  const {
    data: alerts,
    isLoading,
    error,
    refresh,
  } = useQuery(
    () => isAuthenticated ? witnessApi.listAlerts() : Promise.resolve([]),
    [isAuthenticated],
    { enabled: isAuthenticated, intervalMs: 10_000 },
  );

  const { mutate: acknowledge, isLoading: acking } = useMutation(witnessApi.acknowledge);
  const { mutate: reveal, isLoading: revealing }   = useMutation(witnessApi.reveal);

  const { mutate: toggleOptIn, isLoading: togglingOptIn } = useMutation(
    (optIn: boolean) => authApi.updateProfile({ witness_opt_in: optIn }),
  );

  if (!isAuthenticated) {
    return (
      <div className="view-container">
        <div className="error-state">
          <Bell size={36} className="error-state-icon" />
          <h3>Sign in to see alerts</h3>
          <p>You need an account to receive and respond to witness alerts.</p>
          <Button variant="secondary" onClick={() => router.push('/auth/login')}>Sign in</Button>
        </div>
      </div>
    );
  }

  async function handleToggleOptIn() {
    if (!user) return;
    const next = !user.witness_opt_in;
    try {
      await toggleOptIn(next);
      updateUser({ witness_opt_in: next });
      toast(next ? 'You will now receive nearby witness alerts.' : 'Witness alerts turned off.', next ? 'ok' : 'info');
    } catch (err) {
      toast(err instanceof AbhayaApiError ? err.message : 'Could not update setting.', 'warn');
    }
  }

  async function handleAcknowledge(alertId: string) {
    try {
      await acknowledge(alertId);
      toast('Alert acknowledged. The person in distress has been notified.', 'ok');
      refresh();
    } catch (err) {
      toast(err instanceof AbhayaApiError ? err.message : 'Could not acknowledge.', 'warn');
    }
  }

  async function handleReveal(alertId: string) {
    setRevealModal(null);
    try {
      await reveal(alertId);
      toast('Your identity has been shared with the person in distress.', 'ok');
      refresh();
    } catch (err) {
      toast(err instanceof AbhayaApiError ? err.message : 'Could not reveal identity.', 'warn');
    }
  }

  const pendingAlerts = alerts?.filter((a) => a.status !== 'revealed') ?? [];

  return (
    <div className="view-container witness-view">
      <PageHeader
        eyebrow="Witness"
        title="Nearby alerts"
        subtitle="Anonymous alerts from people nearby who need help."
      />

      {/* Opt-in toggle */}
      <Panel eyebrow="Setting" icon={<Eye size={18} />} title="Witness mode">
        <div className="settings-toggle">
          <div className="settings-toggle-icon"><Bell size={16} /></div>
          <div className="settings-toggle-info">
            <div className="settings-toggle-title-row">
              <p className="settings-toggle-title">Receive nearby alerts</p>
              {user?.witness_opt_in
                ? <Badge tone="ok">Active</Badge>
                : <Badge tone="neutral">Off</Badge>}
            </div>
            <p className="settings-toggle-desc">
              Get alerted when someone within ~500m triggers an SOS. Your identity stays hidden unless you reveal it.
            </p>
          </div>
          <Switch
            checked={user?.witness_opt_in ?? false}
            label="Toggle witness alerts"
            onClick={handleToggleOptIn}
            disabled={togglingOptIn}
          />
        </div>
      </Panel>

      {/* Alerts list */}
      {!user?.witness_opt_in ? (
        <WitnessOptOutState />
      ) : isLoading ? (
        <AlertsSkeleton />
      ) : error ? (
        <div className="error-state">
          <AlertTriangle size={32} className="error-state-icon" />
          <h3>Could not load alerts</h3>
          <p>{error.message}</p>
          <Button variant="secondary" onClick={refresh}>Try again</Button>
        </div>
      ) : pendingAlerts.length === 0 ? (
        <EmptyAlertsState />
      ) : (
        <div className="witness-alerts-list">
          <AnimatePresence>
            {pendingAlerts.map((alert, i) => (
              <WitnessAlertCard
                key={alert.id}
                alert={alert}
                index={i}
                onAcknowledge={() => handleAcknowledge(alert.id)}
                onReveal={() => setRevealModal(alert.id)}
                acking={acking}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Reveal identity modal */}
      <AnimatePresence>
        {revealModal && (
          <RevealModal
            onConfirm={() => handleReveal(revealModal)}
            onCancel={() => setRevealModal(null)}
            revealing={revealing}
          />
        )}
      </AnimatePresence>

      <WitnessSafetyNotice />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function WitnessAlertCard({ alert, index, onAcknowledge, onReveal, acking }: {
  alert: WitnessAlert; index: number;
  onAcknowledge: () => void; onReveal: () => void; acking: boolean;
}) {
  const createdAt = new Date(alert.incident_created_at);
  const elapsed   = Math.round((Date.now() - createdAt.getTime()) / 60000);

  return (
    <motion.div
      className="witness-alert-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ delay: index * 0.07 }}
    >
      <div className="witness-alert-card-header">
        <div className="witness-pulse-dot" aria-hidden />
        <div className="witness-alert-card-meta">
          <span className="witness-alert-label">SOS nearby</span>
          <span className="witness-alert-time">{elapsed < 1 ? 'Just now' : `${elapsed}m ago`}</span>
        </div>
        <Badge tone={alert.status === 'acknowledged' ? 'ok' : 'warn'}>
          {alert.status === 'acknowledged' ? 'Acknowledged' : 'Needs attention'}
        </Badge>
      </div>

      <div className="witness-alert-card-body">
        <div className="witness-info-chip">
          <MapPin size={13} />
          ~{alert.approx_distance_meters}m away (approximate)
        </div>
        <div className="witness-info-chip">
          <Shield size={13} />
          Your location is not shared with the person in distress
        </div>
      </div>

      <div className="witness-alert-card-actions">
        {alert.status === 'alerted' && (
          <Button
            variant="secondary"
            size="sm"
            icon={acking ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
            onClick={onAcknowledge}
            disabled={acking}
          >
            I see this alert
          </Button>
        )}
        {alert.status === 'acknowledged' && (
          <Button
            variant="ghost"
            size="sm"
            icon={<Eye size={14} />}
            onClick={onReveal}
          >
            Reveal my identity
          </Button>
        )}
        {alert.status === 'revealed' && (
          <Badge tone="ok" icon={<Check size={13} />}>Identity shared</Badge>
        )}
      </div>
    </motion.div>
  );
}

function RevealModal({ onConfirm, onCancel, revealing }: {
  onConfirm: () => void; onCancel: () => void; revealing: boolean;
}) {
  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        className="modal-card"
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-icon tone-warn"><Eye size={22} /></div>
        <h3 className="modal-title">Reveal your identity?</h3>
        <p className="modal-body">
          Your display name will be shared with the person who triggered this SOS. This helps
          them know someone is nearby. This action cannot be undone.
        </p>
        <div className="modal-actions">
          <Button variant="ghost" onClick={onCancel} icon={<X size={14} />}>Cancel</Button>
          <Button
            variant="secondary"
            onClick={onConfirm}
            disabled={revealing}
            icon={revealing ? <Loader2 size={14} className="spin" /> : <Eye size={14} />}
          >
            Reveal identity
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function WitnessOptOutState() {
  return (
    <div className="error-state">
      <EyeOff size={36} style={{ color: 'var(--muted)' }} />
      <h3>Witness alerts are off</h3>
      <p>Turn on witness mode above to receive anonymous alerts when someone nearby needs help.</p>
    </div>
  );
}

function EmptyAlertsState() {
  return (
    <div className="error-state">
      <Users size={36} style={{ color: 'var(--muted)' }} />
      <h3>No active alerts</h3>
      <p>There are no SOS incidents nearby right now. You will be notified when there is one.</p>
    </div>
  );
}

function AlertsSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1, 2].map((i) => (
        <div key={i} className="witness-alert-card">
          <div style={{ height: 20, width: '60%' }} className="skeleton" />
          <div style={{ height: 14, width: '40%', marginTop: 8 }} className="skeleton" />
        </div>
      ))}
    </div>
  );
}

function WitnessSafetyNotice() {
  return (
    <div className="sos-safety-notice" style={{ marginTop: 8 }}>
      <Shield size={14} />
      <p>
        Your identity is always hidden from the person who triggered SOS unless you explicitly
        choose to reveal it. Your location is never shared. Witness mode is opt-in and can be
        turned off at any time.
      </p>
    </div>
  );
}
