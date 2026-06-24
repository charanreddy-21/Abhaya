'use client';

import { useEffect, useRef, useId } from 'react';

export interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  color?: 'forest' | 'red' | 'amber' | 'teal' | 'slate';
  popup?: string;
}

export interface LeafletMapProps {
  center: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  className?: string;
  height?: number | string;
  interactive?: boolean;
  attribution?: boolean;
}

const COLORS: Record<string, string> = {
  forest: '#1f6f50',
  red:    '#e11d48',
  amber:  '#f59e0b',
  teal:   '#0f766e',
  slate:  '#374151',
};

function makeIcon(color: string) {
  const hex = COLORS[color] ?? COLORS.forest;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 32">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20S24 21 24 12C24 5.373 18.627 0 12 0z"
        fill="${hex}" stroke="#fff" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="5" fill="#fff" opacity="0.9"/>
    </svg>`.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function LeafletMap({
  center,
  zoom = 15,
  markers = [],
  className = '',
  height = 300,
  interactive = true,
  attribution = true,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<unknown>(null);
  const uid          = useId();

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;
    if (mapRef.current) return; // already initialised

    let L: typeof import('leaflet');
    let map: import('leaflet').Map;

    async function init() {
      L = (await import('leaflet')).default;

      // Fix default icon paths broken by webpack bundling
      // @ts-expect-error _getIconUrl is internal
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (!containerRef.current) return;
      map = L.map(containerRef.current, {
        center,
        zoom,
        zoomControl:      interactive,
        dragging:         interactive,
        scrollWheelZoom:  interactive,
        doubleClickZoom:  interactive,
        touchZoom:        interactive,
        keyboard:         interactive,
        attributionControl: attribution,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      for (const m of markers) {
        const iconUrl  = makeIcon(m.color ?? 'forest');
        const leafIcon = L.icon({
          iconUrl,
          iconSize:   [24, 32],
          iconAnchor: [12, 32],
          popupAnchor:[0, -32],
        });
        const marker = L.marker([m.lat, m.lng], { icon: leafIcon, title: m.label });
        if (m.popup) {
          marker.bindPopup(`<strong>${m.label}</strong><br>${m.popup}`);
        }
        marker.addTo(map);
      }

      mapRef.current = map;
    }

    init().catch(console.error);

    return () => {
      if (map) {
        map.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only mount once

  // When markers change, rebuild them
  useEffect(() => {
    async function update() {
      if (!mapRef.current) return;
      const L = (await import('leaflet')).default;
      const map = mapRef.current as import('leaflet').Map;

      // Remove old layers (markers only)
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker) map.removeLayer(layer);
      });

      for (const m of markers) {
        const iconUrl  = makeIcon(m.color ?? 'forest');
        const leafIcon = L.icon({ iconUrl, iconSize: [24, 32], iconAnchor: [12, 32], popupAnchor: [0, -32] });
        const marker   = L.marker([m.lat, m.lng], { icon: leafIcon, title: m.label });
        if (m.popup) marker.bindPopup(`<strong>${m.label}</strong><br>${m.popup}`);
        marker.addTo(map);
      }
    }
    update().catch(console.error);
  }, [markers]);

  return (
    <>
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        // eslint-disable-next-line react/no-unknown-property
        crossOrigin=""
      />
      <div
        ref={containerRef}
        id={`leaflet-map-${uid}`}
        className={`leaflet-map-container ${className}`}
        style={{ height }}
        aria-label="Interactive map"
        role="region"
      />
    </>
  );
}
