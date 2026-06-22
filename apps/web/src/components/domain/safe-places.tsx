'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  MapPin, Shield, CheckCircle2, AlertTriangle, Building2,
  Cross, Flame, Car, Clock3, Navigation, Filter,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Panel } from '@/components/ui/panel';
import { PageHeader } from '@/components/ui/page-header';

type VerificationLevel = 'unverified' | 'community' | 'admin';
type PlaceKind = 'police' | 'hospital' | 'pharmacy' | 'petrol' | 'public';

interface SafePlace {
  id: string;
  name: string;
  kind: PlaceKind;
  distance: string;
  address: string;
  verification: VerificationLevel;
  open: boolean;
  lastVerified?: string;
}

const SAFE_PLACES: SafePlace[] = [
  { id: 'p1', name: 'Koramangala Police Station', kind: 'police', distance: '0.3 km', address: '80 Feet Rd, Koramangala', verification: 'admin', open: true, lastVerified: 'Jun 2025' },
  { id: 'p2', name: 'Apollo Clinic', kind: 'hospital', distance: '0.6 km', address: '4th Block, Koramangala', verification: 'community', open: true, lastVerified: 'May 2025' },
  { id: 'p3', name: 'MedPlus Pharmacy', kind: 'pharmacy', distance: '0.8 km', address: 'HSR Layout Sector 1', verification: 'community', open: true, lastVerified: 'Jun 2025' },
  { id: 'p4', name: 'HPCL Petrol Pump', kind: 'petrol', distance: '1.1 km', address: '27th Main, BTM Layout', verification: 'unverified', open: true },
  { id: 'p5', name: 'Forum Mall Security Desk', kind: 'public', distance: '1.4 km', address: 'Hosur Rd, Koramangala', verification: 'community', open: false, lastVerified: 'Apr 2025' },
  { id: 'p6', name: 'SBI Bank Branch', kind: 'public', distance: '1.7 km', address: 'Indiranagar 100 Feet Rd', verification: 'unverified', open: false },
];

type KindFilter = PlaceKind | 'all';

const KIND_FILTERS: { kind: KindFilter; label: string }[] = [
  { kind: 'all', label: 'All' },
  { kind: 'police', label: 'Police' },
  { kind: 'hospital', label: 'Hospital' },
  { kind: 'pharmacy', label: 'Pharmacy' },
  { kind: 'petrol', label: 'Petrol Pump' },
  { kind: 'public', label: 'Public' },
];

export function SafePlacesView() {
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = SAFE_PLACES.filter(p => kindFilter === 'all' || p.kind === kindFilter);
  const selected = SAFE_PLACES.find(p => p.id === selectedId) ?? null;

  return (
    <div className="view-container">
      <PageHeader
        eyebrow="Safe places"
        title="Nearby public places"
        subtitle="Locations that may offer help during an emergency. Verification level is shown for each."
        actions={
          <Badge tone="warn" icon={<AlertTriangle size={13} />}>
            Routes are not guaranteed safe
          </Badge>
        }
      />

      <SafePlaceMapZone places={filtered} selectedId={selectedId} onSelect={setSelectedId} />

      <div className="safe-places-body">
        <div className="safe-places-filters">
          <Filter size={16} />
          {KIND_FILTERS.map(({ kind, label }) => (
            <button
              key={kind}
              className={`filter-tab ${kindFilter === kind ? 'is-active' : ''}`}
              onClick={() => setKindFilter(kind)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="safe-places-list-grid">
          <div className="safe-places-list">
            {filtered.map((place, i) => (
              <SafePlaceCard
                key={place.id}
                place={place}
                index={i}
                selected={place.id === selectedId}
                onSelect={() => setSelectedId(place.id === selectedId ? null : place.id)}
              />
            ))}
          </div>

          {selected && (
            <motion.div
              key={selected.id}
              className="safe-place-detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <SafePlaceDetail place={selected} />
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

function SafePlaceMapZone({ places, selectedId, onSelect }: {
  places: SafePlace[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="safe-map-zone">
      <div className="safe-map-grid" />
      <div className="safe-map-you">
        <Navigation size={16} />
      </div>
      {places.slice(0, 4).map((place, i) => (
        <button
          key={place.id}
          className={`safe-map-pin pin-${i} ${selectedId === place.id ? 'is-selected' : ''} kind-${place.kind}`}
          onClick={() => onSelect(place.id)}
          type="button"
          aria-label={place.name}
        >
          <PlaceIcon kind={place.kind} size={13} />
        </button>
      ))}
      <div className="safe-map-legend">
        <span><span className="legend-dot dot-teal" />You</span>
        <span><span className="legend-dot dot-green" />Admin verified</span>
        <span><span className="legend-dot dot-amber" />Community confirmed</span>
        <span><span className="legend-dot dot-line" />Unverified</span>
      </div>
    </div>
  );
}

function SafePlaceCard({ place, index, selected, onSelect }: {
  place: SafePlace;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      className={`safe-place-card ${selected ? 'is-selected' : ''}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      onClick={onSelect}
      type="button"
      aria-pressed={selected}
    >
      <div className={`place-icon kind-${place.kind}`}>
        <PlaceIcon kind={place.kind} size={18} />
      </div>
      <div className="place-card-info">
        <div className="place-card-top">
          <h3>{place.name}</h3>
          <span className={`place-open-dot ${place.open ? 'is-open' : 'is-closed'}`} />
        </div>
        <p className="place-address">{place.address}</p>
        <div className="place-card-badges">
          <Badge tone="neutral" icon={<Navigation size={12} />}>{place.distance}</Badge>
          <VerificationBadge level={place.verification} />
          {!place.open && <Badge tone="warn">Closed</Badge>}
        </div>
      </div>
    </motion.button>
  );
}

function SafePlaceDetail({ place }: { place: SafePlace }) {
  return (
    <Panel eyebrow="Place details" icon={<PlaceIcon kind={place.kind} size={18} />} title={place.name}>
      <div className="place-detail-rows">
        <div className="place-detail-row">
          <MapPin size={15} className="detail-icon" />
          <div>
            <p className="detail-label">Address</p>
            <p className="detail-value">{place.address}</p>
          </div>
        </div>
        <div className="place-detail-row">
          <Navigation size={15} className="detail-icon" />
          <div>
            <p className="detail-label">Distance</p>
            <p className="detail-value">{place.distance}</p>
          </div>
        </div>
        <div className="place-detail-row">
          <Clock3 size={15} className="detail-icon" />
          <div>
            <p className="detail-label">Status</p>
            <p className="detail-value">{place.open ? 'Open now' : 'Currently closed'}</p>
          </div>
        </div>
        <div className="place-detail-row">
          <Shield size={15} className="detail-icon" />
          <div>
            <p className="detail-label">Verification</p>
            <VerificationBadge level={place.verification} />
            {place.lastVerified && <p className="detail-meta">Last checked: {place.lastVerified}</p>}
          </div>
        </div>
      </div>
      <div className="place-disclaimer">
        <AlertTriangle size={14} />
        <p>
          {place.verification === 'unverified'
            ? 'This place has not been verified. Treat with caution.'
            : 'Verified places may not be safe in all situations. Use your judgement.'}
        </p>
      </div>
    </Panel>
  );
}

function VerificationBadge({ level }: { level: VerificationLevel }) {
  if (level === 'admin') return <Badge tone="ok" icon={<CheckCircle2 size={12} />}>Admin verified</Badge>;
  if (level === 'community') return <Badge tone="info" icon={<Shield size={12} />}>Community confirmed</Badge>;
  return <Badge tone="neutral">Unverified</Badge>;
}

function PlaceIcon({ kind, size }: { kind: PlaceKind; size: number }) {
  if (kind === 'police') return <Shield size={size} />;
  if (kind === 'hospital') return <Cross size={size} />;
  if (kind === 'pharmacy') return <Cross size={size} />;
  if (kind === 'petrol') return <Flame size={size} />;
  if (kind === 'public') return <Building2 size={size} />;
  return <MapPin size={size} />;
}
