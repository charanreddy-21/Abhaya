'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Building2, CheckCircle2, ChevronLeft,
  MapPin, ShieldCheck, Trash2, ToggleLeft, ToggleRight,
} from 'lucide-react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { useQuery, useMutation } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';
import type { SafePlace, VerificationLevel } from '@/lib/types';

const KIND_LABELS: Record<string, string> = {
  police: 'Police',
  hospital: 'Hospital',
  pharmacy: 'Pharmacy',
  petrol: 'Petrol station',
  shelter: 'Shelter',
};

const VERIFICATION_LEVELS: VerificationLevel[] = ['unverified', 'community', 'admin'];

function VerificationBadge({ level }: { level: VerificationLevel }) {
  if (level === 'admin')     return <Badge tone="ok" icon={<ShieldCheck size={11} />}>Admin verified</Badge>;
  if (level === 'community') return <Badge tone="info" icon={<CheckCircle2 size={11} />}>Community</Badge>;
  return <Badge tone="neutral">Unverified</Badge>;
}

export function AdminSafePlacesView() {
  const { toast } = useToast();
  const [kindFilter, setKindFilter] = useState<string | undefined>(undefined);

  const { data: places, isLoading, error, refresh } = useQuery(
    () => adminApi.listSafePlaces({ kind: kindFilter }),
    [kindFilter],
    { intervalMs: 60_000 },
  );

  const { mutate: doVerify, isLoading: verifying } = useMutation(
    ({ id, level }: { id: string; level: VerificationLevel }) =>
      adminApi.verifySafePlace(id, level),
  );

  const { mutate: doToggleOpen } = useMutation(
    ({ id, is_open }: { id: string; is_open: boolean }) =>
      adminApi.setSafePlaceOpen(id, is_open),
  );

  const { mutate: doDelete } = useMutation(
    (id: string) => adminApi.deleteSafePlace(id),
  );

  async function handleVerify(id: string, level: VerificationLevel) {
    try { await doVerify({ id, level }); toast('Verification updated.', 'ok'); refresh(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Failed.', 'warn'); }
  }

  async function handleToggleOpen(id: string, is_open: boolean) {
    try { await doToggleOpen({ id, is_open }); toast('Status updated.', 'ok'); refresh(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Failed.', 'warn'); }
  }

  async function confirmDelete(place: SafePlace) {
    if (!window.confirm(`Remove "${place.name}"? This cannot be undone.`)) return;
    try { await doDelete(place.id); toast('Safe place removed.', 'ok'); refresh(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Failed.', 'warn'); }
  }

  const kindCounts = (places ?? []).reduce<Record<string, number>>((acc, p) => {
    acc[p.kind] = (acc[p.kind] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="view-container admin-safe-places-view">
      <PageHeader
        eyebrow="Admin"
        title="Safe places"
        subtitle="Review, verify, and manage all community-submitted safe locations."
        actions={
          <Link href="/admin" className="btn btn-sm btn-ghost">
            <ChevronLeft size={14} />
            Back
          </Link>
        }
      />

      <div className="admin-sp-toolbar">
        <div className="audit-filters" role="group" aria-label="Filter by kind">
          <MapPin size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          <button
            type="button"
            className={`filter-tab ${!kindFilter ? 'is-active' : ''}`}
            onClick={() => setKindFilter(undefined)}
          >
            All {places && `(${places.length})`}
          </button>
          {Object.entries(KIND_LABELS).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={`filter-tab ${kindFilter === k ? 'is-active' : ''}`}
              onClick={() => setKindFilter(k)}
            >
              {label} {kindCounts[k] != null ? `(${kindCounts[k]})` : ''}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <SafePlacesSkeleton />
      ) : error ? (
        <div className="error-state">
          <AlertTriangle size={28} className="error-state-icon" />
          <h3>Could not load safe places</h3>
          <p>{error.message}</p>
          <Button variant="secondary" size="sm" onClick={refresh}>Retry</Button>
        </div>
      ) : (places ?? []).length === 0 ? (
        <div className="error-state" style={{ paddingBlock: 32 }}>
          <MapPin size={32} style={{ color: 'var(--muted)' }} />
          <h3>No safe places</h3>
          <p>Community-submitted locations will appear here.</p>
        </div>
      ) : (
        <div className="admin-sp-table">
          <div className="admin-sp-head">
            <span>Name</span>
            <span>Kind</span>
            <span>Status</span>
            <span>Verification</span>
            <span>Actions</span>
          </div>
          <AnimatePresence mode="popLayout">
            {(places ?? []).map((place, i) => (
              <motion.div
                key={place.id}
                className="admin-sp-row"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ delay: Math.min(i * 0.04, 0.5) }}
              >
                <span className="admin-sp-name">
                  <Building2 size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                  <span>{place.name}</span>
                  {place.address && <span className="admin-sp-address">{place.address}</span>}
                </span>

                <span>
                  <span className="admin-sp-kind">{KIND_LABELS[place.kind] ?? place.kind}</span>
                </span>

                <span>
                  <button
                    type="button"
                    className={`admin-sp-open-toggle ${place.is_open ? 'is-open' : ''}`}
                    onClick={() => handleToggleOpen(place.id, !place.is_open)}
                    aria-label={`Mark as ${place.is_open ? 'closed' : 'open'}`}
                    title={`Currently ${place.is_open ? 'open' : 'closed'} — click to toggle`}
                  >
                    {place.is_open
                      ? <><ToggleRight size={16} /> Open</>
                      : <><ToggleLeft size={16} /> Closed</>}
                  </button>
                </span>

                <span>
                  <select
                    className="admin-sp-verify-select"
                    value={place.verification_level}
                    disabled={verifying}
                    onChange={(e) =>
                      handleVerify(place.id, e.target.value as VerificationLevel)
                    }
                    aria-label={`Verification level for ${place.name}`}
                  >
                    {VERIFICATION_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l.charAt(0).toUpperCase() + l.slice(1)}
                      </option>
                    ))}
                  </select>
                  <VerificationBadge level={place.verification_level} />
                </span>

                <span className="admin-sp-actions">
                  <button
                    type="button"
                    className="admin-sp-delete-btn"
                    onClick={() => confirmDelete(place)}
                    aria-label={`Delete ${place.name}`}
                    title="Delete this place"
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="audit-notice">
        <ShieldCheck size={13} />
        <p>
          Admin-verified places are shown with higher confidence to users in distress.
          Only verify places you have confirmed are safe and operational.
        </p>
      </div>
    </div>
  );
}

function SafePlacesSkeleton() {
  return (
    <div className="admin-sp-table">
      <div className="admin-sp-head">
        <span>Name</span><span>Kind</span><span>Status</span><span>Verification</span><span>Actions</span>
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="admin-sp-row" aria-hidden>
          <div className="skeleton skeleton-text" style={{ width: '55%' }} />
          <div className="skeleton skeleton-text" style={{ width: 80 }} />
          <div className="skeleton skeleton-text" style={{ width: 60 }} />
          <div className="skeleton" style={{ width: 90, height: 22, borderRadius: 12 }} />
          <div />
        </div>
      ))}
    </div>
  );
}
