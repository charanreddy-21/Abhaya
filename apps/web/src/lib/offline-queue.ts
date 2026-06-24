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
    return raw ? (JSON.parse(raw) as PendingSOS) : null;
  } catch {
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

export function isPendingSOSStale(entry: PendingSOS, maxAgeMinutes = 30): boolean {
  const queued = new Date(entry.queuedAt).getTime();
  return Date.now() - queued > maxAgeMinutes * 60 * 1000;
}
