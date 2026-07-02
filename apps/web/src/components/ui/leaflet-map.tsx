'use client';

import { useEffect, useRef, useId } from 'react';
import type { MutableRefObject } from 'react';

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
  circles?: MapCircle[];
  className?: string;
  height?: number | string;
  interactive?: boolean;
  attribution?: boolean;
  ariaLabel?: string;
}

export interface MapCircle {
  lat: number;
  lng: number;
  radiusMeters: number;
  color?: 'forest' | 'red' | 'amber' | 'teal' | 'slate';
  fillOpacity?: number;
  label?: string;
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
  circles = [],
  className = '',
  height = 300,
  interactive = true,
  attribution = true,
  ariaLabel = 'Interactive map',
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<unknown>(null);
  const dynamicLayersRef = useRef<unknown[]>([]);
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

      mapRef.current = map;
      renderDynamicLayers(L, map, markers, circles, dynamicLayersRef);
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

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current as import('leaflet').Map;
    map.setView(center, zoom, { animate: true });
  }, [center, zoom]);

  // When markers or circles change, rebuild only those overlays.
  useEffect(() => {
    async function update() {
      if (!mapRef.current) return;
      const L = (await import('leaflet')).default;
      const map = mapRef.current as import('leaflet').Map;
      renderDynamicLayers(L, map, markers, circles, dynamicLayersRef);
    }
    update().catch(console.error);
  }, [markers, circles]);

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
        aria-label={ariaLabel}
        role="region"
      />
    </>
  );
}

function renderDynamicLayers(
  L: typeof import('leaflet'),
  map: import('leaflet').Map,
  markers: MapMarker[],
  circles: MapCircle[],
  layerRef: MutableRefObject<unknown[]>,
) {
  for (const layer of layerRef.current) {
    map.removeLayer(layer as import('leaflet').Layer);
  }
  layerRef.current = [];

  for (const c of circles) {
    const color = COLORS[c.color ?? 'red'] ?? COLORS.red;
    const circle = L.circle([c.lat, c.lng], {
      radius: c.radiusMeters,
      color,
      fillColor: color,
      fillOpacity: c.fillOpacity ?? 0.12,
      weight: 2,
    });
    if (c.label) circle.bindTooltip(c.label);
    circle.addTo(map);
    layerRef.current.push(circle);
  }

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
      const popup = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = m.label;
      popup.append(title);
      popup.append(document.createElement('br'), document.createTextNode(m.popup));
      marker.bindPopup(popup);
    }
    marker.addTo(map);
    layerRef.current.push(marker);
  }
}
