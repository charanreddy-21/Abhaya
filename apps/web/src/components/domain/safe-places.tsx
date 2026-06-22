'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Building2, CheckCircle2, ChevronRight,
  Flame, Loader2, MapPin, Navigation, Shield, ShoppingBag,
  Siren, X,
} from 'lucide-react';
import { safePlacesApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import { useQuery, useGeolocation, useMutation } from '@/lib/hooks';
import { AbhayaApiError } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { PageHeader } from '@/components/ui/page-header';
import type { CreateSafePlacePayload, SafePlace, SafePlaceKind, VerificationLevel } from '@/lib/types';

type KindFilter = 'all' | SafePlaceKind;

const KIND_META: Record<SafePlaceKind, { icon: React.ReactNode; label: string }> = {
  police:   { icon: <Siren size={16} />,       label: 'Police' },
  hospital: { icon: <Building2 size={16} />,   label: 'Hospital' },
  pharmacy: { icon: <ShoppingBag size={16} />, label: 'Pharmacy' },
  petrol:   { icon: <Flame size={16} />,       label: 'Petrol' },
  shelter:  { icon: <Shield size={16} />,      label: 'Shelter' },
};

const KIND_TONE: Record<SafePlaceKind, string> = {
  police: 'forest', hospital: 'danger', pharmacy: 'teal', petrol: 'amber', shelter: 'info',
};

const ALL_KINDS: KindFilter[] = ['all', 'police', 'hospital', 'pharmacy', 'petrol', 'shelter'];

export function SafePlacesView() {
  const { toast } = useToast();
  const geo = useGeolocation();
  const { isAuthenticated } = useAuth();
  const [kindFilter, setKindFilter]     = useState<KindFilter>('all');
  const [selected, setSelected]         = useState<SafePlace | null>(null);
  const [showSubmit, setShowSubmit]     = useState(false);

  const { data: places, isLoading, error, refresh } = useQuery(
    () => safePlacesApi.list({
      lat:    geo.position?.latitude,
      lng:    geo.position?.longitude,
      radius: 5000,
      kind:   kindFilter !== 'all' ? kindFilter : undefined,
    }),
    [kindFilter, geo.position?.latitude, geo.position?.longitude],
  );

  return (
    <div className="view-container safe-places-view">
      <PageHeader
        eyebrow="Safe places"
        title="Nearby safety locations"
        subtitle="Verified and community-submitted locations. Always confirm before relying on these in an emergency."
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={geo.isLoading ? <Loader2 size={15} className="spin" /> : <Navigation size={15} />}
            onClick={geo.request}
            disabled={geo.isLoading}
          >
            {geo.position ? 'Location active' : 'Use location'}
          </Button>
        }
      />

      <div className="filter-tabs">
        {ALL_KINDS.map((k) => (
          <button
            key={k}
            className={`filter-tab ${kindFilter === k ? 'is-active' : ''}`}
            onClick={() => setKindFilter(k)}
            type="button"
          >
            {k === 'all' ? 'All' : KIND_META[k as SafePlaceKind].label}
          </button>
        ))}
      </div>

      <div className="safe-places-layout">
        <div className="safe-places-list-col">
          {isLoading ? (
            <SafePlacesSkeleton />
          ) : error ? (
            <div className="error-state">
              <AlertTriangle size={32} className="error-state-icon" />
              <h3>Could not load locations</h3>
              <p>{error.message}</p>
              <Button variant="secondary" onClick={refresh}>Try again</Button>
            </div>
          ) : (places ?? []).length === 0 ? (
            <div className="error-state">
              <MapPin size={32} style={{ color: 'var(--muted)' }} />
              <h3>No locations found</h3>
              <p>
                {kindFilter !== 'all'
                  ? `No ${KIND_META[kindFilter as SafePlaceKind].label} locations in the database.`
                  : 'No locations in the database yet.'}
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {(places ?? []).map((place, i) => (
                <SafePlaceCard
                  key={place.id}
                  place={place}
                  index={i}
                  selected={selected?.id === place.id}
                  onSelect={() => setSelected(selected?.id === place.id ? null : place)}
                />
              ))}
            </AnimatePresence>
          )}
        </div>

        <AnimatePresence>
          {selected && (
            <motion.div
              key={selected.id}
              className="safe-place-detail-panel"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <SafePlaceDetail place={selected} onClose={() => setSelected(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="sos-safety-notice">
        <AlertTriangle size={14} />
        <p>
          Admin-verified locations are confirmed by our team. Community places are submitted by
          users and may be outdated. Always call ahead in urgent situations.
        </p>
      </div>

      {isAuthenticated && (
        <div className="safe-places-submit-row">
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Know a place that should be here?</p>
          <Button
            variant="ghost"
            size="sm"
            icon={<MapPin size={14} />}
            onClick={() => setShowSubmit(true)}
          >
            Submit a location
          </Button>
        </div>
      )}

      <AnimatePresence>
        {showSubmit && (
          <SubmitPlaceModal
            geo={geo.position}
            onClose={() => setShowSubmit(false)}
            onSuccess={() => { setShowSubmit(false); refresh(); toast('Location submitted for review.', 'ok'); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SafePlaceCard({ place, index, selected, onSelect }: {
  place: SafePlace; index: number; selected: boolean; onSelect: () => void;
}) {
  const meta = KIND_META[place.kind];
  const tone = KIND_TONE[place.kind];

  return (
    <motion.button
      className={`safe-place-card ${selected ? 'is-selected' : ''}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onSelect}
      type="button"
      aria-pressed={selected}
    >
      <div className={`safe-place-kind-icon tone-${tone}`}>{meta.icon}</div>
      <div className="safe-place-card-body">
        <div className="safe-place-card-header">
          <span className="safe-place-name">{place.name}</span>
          <VerificationBadge level={place.verification_level} />
        </div>
        <div className="safe-place-card-meta">
          {place.distance_meters != null && (
            <span className="safe-place-distance">~{formatDistance(place.distance_meters)}</span>
          )}
          <span className={`safe-place-open ${place.is_open ? 'is-open' : 'is-closed'}`}>
            {place.is_open ? 'Open' : 'May be closed'}
          </span>
        </div>
        {place.address && <p className="safe-place-address">{place.address}</p>}
      </div>
      <ChevronRight size={16} className="safe-place-chevron" />
    </motion.button>
  );
}

function SafePlaceDetail({ place, onClose }: { place: SafePlace; onClose: () => void }) {
  const meta = KIND_META[place.kind];
  const tone = KIND_TONE[place.kind];

  return (
    <Panel
      eyebrow={meta.label}
      icon={<span className={`tone-${tone}`}>{meta.icon}</span>}
      title={place.name}
    >
      <button
        className="safe-place-detail-close"
        onClick={onClose}
        type="button"
        aria-label="Close detail panel"
      >
        <X size={16} />
      </button>
      <div className="safe-place-detail-body">
        {place.address && (
          <div className="safe-detail-row">
            <MapPin size={14} className="safe-detail-icon" />
            <span>{place.address}</span>
          </div>
        )}
        {place.distance_meters != null && (
          <div className="safe-detail-row">
            <Navigation size={14} className="safe-detail-icon" />
            <span>~{formatDistance(place.distance_meters)} from your location</span>
          </div>
        )}
        <div className="safe-detail-row">
          <CheckCircle2 size={14} className="safe-detail-icon" />
          <span className={place.is_open ? 'color-forest' : 'color-muted'}>
            {place.is_open ? 'Likely open' : 'May be closed — verify before going'}
          </span>
        </div>
        <VerificationBadge level={place.verification_level} />
      </div>
      <p className="panel-footnote">
        Abhaya cannot guarantee hours or services. Always confirm directly in an emergency.
      </p>
    </Panel>
  );
}

function VerificationBadge({ level }: { level: VerificationLevel }) {
  if (level === 'admin')     return <Badge tone="ok" icon={<CheckCircle2 size={11} />}>Verified</Badge>;
  if (level === 'community') return <Badge tone="info" icon={<Shield size={11} />}>Community</Badge>;
  return <Badge tone="neutral">Unverified</Badge>;
}

function SafePlacesSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="safe-place-card" aria-hidden>
          <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton skeleton-text" style={{ width: '55%' }} />
            <div className="skeleton skeleton-text sm" style={{ width: '35%', marginTop: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SubmitPlaceModal({ geo, onClose, onSuccess }: {
  geo: GeolocationCoordinates | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [name, setName]       = useState('');
  const [kind, setKind]       = useState<SafePlaceKind>('police');
  const [address, setAddress] = useState('');
  const [isOpen, setIsOpen]   = useState(true);

  const { mutate: submitPlace, isLoading } = useMutation(
    (payload: CreateSafePlacePayload) => safePlacesApi.create(payload),
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!geo) { toast('Enable location first so we can record the coordinates.', 'warn'); return; }
    if (!name.trim()) return;
    try {
      await submitPlace({
        name: name.trim(),
        kind,
        lat: geo.latitude,
        lng: geo.longitude,
        address: address.trim() || undefined,
        is_open: isOpen,
      });
      onSuccess();
    } catch (err) {
      toast(err instanceof AbhayaApiError ? err.message : 'Could not submit location.', 'warn');
    }
  }

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.form
        className="modal-card submit-place-form"
        initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="modal-icon tone-info"><MapPin size={22} /></div>
        <h3 className="modal-title">Submit a location</h3>
        <p className="modal-body">
          Add a community-verified safety location. Your coordinates will be recorded.
          Submitted places are visible immediately with Community status.
        </p>

        {!geo && (
          <div className="evidence-notice warn" style={{ width: '100%', margin: 0 }}>
            <AlertTriangle size={13} />
            Enable location first — coordinates are required.
          </div>
        )}

        <div className="submit-place-fields">
          <div className="auth-field">
            <label className="auth-label" htmlFor="place-name">Place name</label>
            <input
              id="place-name"
              className="auth-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Apollo Pharmacy, Koramangala"
              required
              maxLength={128}
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="place-kind">Category</label>
            <select
              id="place-kind"
              className="auth-input"
              value={kind}
              onChange={(e) => setKind(e.target.value as SafePlaceKind)}
            >
              {(['police', 'hospital', 'pharmacy', 'petrol', 'shelter'] as SafePlaceKind[]).map((k) => (
                <option key={k} value={k}>{KIND_META[k].label}</option>
              ))}
            </select>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="place-address">Address (optional)</label>
            <input
              id="place-address"
              className="auth-input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address or landmark"
              maxLength={256}
            />
          </div>

          <label className="submit-place-open-toggle">
            <input
              type="checkbox"
              checked={isOpen}
              onChange={(e) => setIsOpen(e.target.checked)}
            />
            Currently open
          </label>
        </div>

        <div className="modal-actions">
          <Button variant="ghost" type="button" onClick={onClose} icon={<X size={14} />}>Cancel</Button>
          <Button
            variant="secondary"
            type="submit"
            disabled={isLoading || !geo || !name.trim()}
            icon={isLoading ? <Loader2 size={14} className="spin" /> : <MapPin size={14} />}
          >
            Submit location
          </Button>
        </div>
      </motion.form>
    </motion.div>
  );
}

function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}
