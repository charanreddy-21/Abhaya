// Offline SOS pending queue.
// When a user triggers SOS but the network is down, we store the intent
// in localStorage and retry automatically when the network returns.
// Only one pending SOS is stored (most recent wins).

import type { CreateSOSPayload } from './types';

const QUEUE_KEY = 'abhaya_pending_sos';

export interface PendingSOS {
  payload:   CreateSOSPayload;
  queuedAt:  string; // ISO timestamp
  attempts:  number;
}

export function enqueuePendingSOS(payload: CreateSOSPayload): void {
  const entry: PendingSOS = {
    payload,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(entry));
  } catch { /* storage unavailable */ }
}

export function getPendingSOS(): PendingSOS | null {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingSOS>;
    if (
      !parsed.payload ||
      typeof parsed.payload.lat !== 'number' ||
      typeof parsed.payload.lng !== 'number' ||
      Number.isNaN(parsed.payload.lat) ||
      Number.isNaN(parsed.payload.lng)
    ) {
      clearPendingSOS();
      return null;
    }
    return {
      payload: parsed.payload,
      queuedAt: parsed.queuedAt ?? new Date().toISOString(),
      attempts: parsed.attempts ?? 0,
    };
  } catch {
    clearPendingSOS();
    return null;
  }
}

export function incrementAttempts(entry: PendingSOS): void {
  try {
    const updated: PendingSOS = { ...entry, attempts: entry.attempts + 1 };
    localStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
  } catch { /* noop */ }
}

export function clearPendingSOS(): void {
  try {
    localStorage.removeItem(QUEUE_KEY);
  } catch { /* noop */ }
}

export function isPendingSOSStale(entry: PendingSOS, maxAgeMinutes = 10): boolean {
  const queued = new Date(entry.queuedAt).getTime();
  const captured = entry.payload.location_captured_at
    ? new Date(entry.payload.location_captured_at).getTime()
    : queued;
  if (Number.isNaN(queued) || Number.isNaN(captured)) return true;
  return Date.now() - Math.min(queued, captured) > maxAgeMinutes * 60 * 1000;
}
