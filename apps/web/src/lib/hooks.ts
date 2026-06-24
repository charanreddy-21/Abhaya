'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { AbhayaApiError, NetworkError } from './api-client';

// ── useQuery — generic data fetcher ───────────────────────────────────────────

export interface QueryState<T> {
  data: T | null;
  error: AbhayaApiError | NetworkError | null;
  isLoading: boolean;
  isRefreshing: boolean;
}

export function useQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  options: { enabled?: boolean; intervalMs?: number } = {},
): QueryState<T> & { refresh: () => void } {
  const { enabled = true, intervalMs } = options;

  const [state, setState] = useState<QueryState<T>>({
    data: null,
    error: null,
    isLoading: true,
    isRefreshing: false,
  });

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback((isRefresh = false) => {
    if (!enabled) return;
    setState((s) => ({ ...s, isLoading: !isRefresh || !s.data, isRefreshing: isRefresh && !!s.data, error: null }));
    fetcherRef.current()
      .then((data) => setState({ data, error: null, isLoading: false, isRefreshing: false }))
      .catch((err) => setState((s) => ({
        ...s,
        error: err instanceof AbhayaApiError || err instanceof NetworkError ? err : new NetworkError(),
        isLoading: false,
        isRefreshing: false,
      })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => { run(false); }, [run]);

  useEffect(() => {
    if (!intervalMs) return;
    const id = setInterval(() => run(true), intervalMs);
    return () => clearInterval(id);
  }, [run, intervalMs]);

  return { ...state, refresh: () => run(true) };
}

// ── useMutation — fire-and-forget with loading state ─────────────────────────

export interface MutationState<T> {
  data: T | null;
  error: AbhayaApiError | NetworkError | null;
  isLoading: boolean;
}

export function useMutation<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
): MutationState<TResult> & { mutate: (...args: TArgs) => Promise<TResult> } {
  const [state, setState] = useState<MutationState<TResult>>({
    data: null,
    error: null,
    isLoading: false,
  });

  const mutate = useCallback(
    async (...args: TArgs): Promise<TResult> => {
      setState({ data: null, error: null, isLoading: true });
      try {
        const data = await fn(...args);
        setState({ data, error: null, isLoading: false });
        return data;
      } catch (err) {
        const apiErr = err instanceof AbhayaApiError || err instanceof NetworkError
          ? err
          : new NetworkError();
        setState({ data: null, error: apiErr, isLoading: false });
        throw err;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn],
  );

  return { ...state, mutate };
}

// ── useOnlineStatus — network connectivity ────────────────────────────────────

export function useOnlineStatus(): boolean {
  // Start true on both server and client first paint to avoid hydration mismatch.
  // useEffect syncs with actual browser state after hydration.
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  return online;
}

// ── useGeolocation ────────────────────────────────────────────────────────────

export interface GeoState {
  position: GeolocationCoordinates | null;
  error: GeolocationPositionError | null;
  isLoading: boolean;
}

export function useGeolocation(options?: PositionOptions): GeoState & { request: () => void } {
  const [state, setState] = useState<GeoState>({ position: null, error: null, isLoading: false });

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) return;
    setState((s) => ({ ...s, isLoading: true, error: null }));
    navigator.geolocation.getCurrentPosition(
      (pos) => setState({ position: pos.coords, error: null, isLoading: false }),
      (err) => setState({ position: null, error: err, isLoading: false }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 15_000, ...options },
    );
  }, [options]);

  return { ...state, request };
}

// ── useElapsedSeconds ─────────────────────────────────────────────────────────

export function useElapsedSeconds(startIso: string | null): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startIso) { setElapsed(0); return; }
    const start = new Date(startIso).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startIso]);

  return elapsed;
}

// ── useLocalStorage ───────────────────────────────────────────────────────────

export function useLocalStorage<T>(key: string, initial: T): [T, (val: T) => void] {
  const [value, setInner] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  const set = useCallback((val: T) => {
    setInner(val);
    localStorage.setItem(key, JSON.stringify(val));
  }, [key]);

  return [value, set];
}

// ── useDebounce ───────────────────────────────────────────────────────────────

export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}

// ── formatElapsed ─────────────────────────────────────────────────────────────

export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}
