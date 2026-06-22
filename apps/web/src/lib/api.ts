// ── Typed API endpoint functions ───────────────────────────────────────────────

import { http } from './api-client';
import type {
  AdminIncident,
  AdminIncidentDetail,
  AuditLogPage,
  AuthResponse,
  CreateSafePlacePayload,
  CreateSOSPayload,
  EvidenceItem,
  Incident,
  SafePlace,
  SystemMetrics,
  UpdateProfilePayload,
  User,
  WitnessAlert,
} from './types';

// ── Auth ───────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (email: string, password: string, display_name: string) =>
    http.post<AuthResponse>('/api/auth/register', { email, password, display_name }),

  login: (email: string, password: string) =>
    http.post<AuthResponse>('/api/auth/login', { email, password }),

  me: () =>
    http.get<User>('/api/auth/me'),

  updateProfile: (payload: UpdateProfilePayload) =>
    http.patch<User>('/api/auth/me', payload),
};

// ── SOS ────────────────────────────────────────────────────────────────────────

export const sosApi = {
  create: (payload: CreateSOSPayload) =>
    http.post<Incident>('/api/sos', payload),

  getActive: () =>
    http.get<Incident[]>('/api/sos/active'),

  getHistory: () =>
    http.get<Incident[]>('/api/sos/history'),

  get: (id: string) =>
    http.get<Incident>(`/api/sos/${id}`),

  resolve: (id: string) =>
    http.post<Incident>(`/api/sos/${id}/resolve`),
};

// ── Witness Alerts ─────────────────────────────────────────────────────────────

export const witnessApi = {
  listAlerts: () =>
    http.get<WitnessAlert[]>('/api/witness/alerts'),

  acknowledge: (alertId: string) =>
    http.post<WitnessAlert>(`/api/witness/alerts/${alertId}/acknowledge`),

  reveal: (alertId: string) =>
    http.post<WitnessAlert>(`/api/witness/alerts/${alertId}/reveal`),
};

// ── Evidence ───────────────────────────────────────────────────────────────────

export const evidenceApi = {
  list: () =>
    http.get<EvidenceItem[]>('/api/evidence'),

  upload: (incidentId: string, kind: string, label: string, sha256Hash: string, file: File) => {
    const meta = JSON.stringify({ incident_id: incidentId, kind, label, sha256_hash: sha256Hash });
    const form = new FormData();
    form.append('meta', meta);
    form.append('file', file);
    return http.upload<EvidenceItem>('/api/evidence', form);
  },

  delete: (id: string) =>
    http.delete(`/api/evidence/${id}`),

  downloadUrl: (id: string) =>
    `${process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'}/api/evidence/${id}/download`,
};

// ── Safe Places ────────────────────────────────────────────────────────────────

export interface ListSafePlacesParams {
  lat?: number;
  lng?: number;
  radius?: number;
  kind?: string;
}

export const safePlacesApi = {
  list: (p?: ListSafePlacesParams) =>
    http.get<SafePlace[]>('/api/safe-places', {
      params: p as Record<string, string | number | boolean | null | undefined>,
    }),

  get: (id: string, lat?: number, lng?: number) =>
    http.get<SafePlace>(`/api/safe-places/${id}`, { params: { lat, lng } }),

  create: (payload: CreateSafePlacePayload) =>
    http.post<SafePlace>('/api/safe-places', payload),
};

// ── Admin ──────────────────────────────────────────────────────────────────────

export const adminApi = {
  getMetrics: () =>
    http.get<SystemMetrics>('/api/admin/metrics'),

  listIncidents: (status?: 'active' | 'resolved', limit = 50, offset = 0) =>
    http.get<AdminIncident[]>('/api/admin/incidents', { params: { status, limit, offset } }),

  getIncident: (id: string) =>
    http.get<AdminIncidentDetail>(`/api/admin/incidents/${id}`),

  resolveIncident: (id: string) =>
    http.post<AdminIncident>(`/api/admin/incidents/${id}/resolve`),

  listAuditLog: (params?: { action?: string; limit?: number; offset?: number }) =>
    http.get<AuditLogPage>('/api/admin/audit', {
      params: params as Record<string, string | number | boolean | null | undefined>,
    }),

  listSafePlaces: (params?: { kind?: string }) =>
    http.get<SafePlace[]>('/api/safe-places', {
      params: params as Record<string, string | number | boolean | null | undefined>,
    }),

  verifySafePlace: (id: string, level: 'unverified' | 'community' | 'admin') =>
    http.patch<SafePlace>(`/api/admin/safe-places/${id}/verify`, { level }),

  setSafePlaceOpen: (id: string, is_open: boolean) =>
    http.patch<SafePlace>(`/api/admin/safe-places/${id}/open`, { is_open }),

  deleteSafePlace: (id: string) =>
    http.delete(`/api/admin/safe-places/${id}`),
};

// ── Notifications ──────────────────────────────────────────────────────────────

export const notificationsApi = {
  subscribe: (endpoint: string) =>
    http.post<void>('/api/notifications/subscribe', { endpoint }),

  unsubscribe: () =>
    http.delete('/api/notifications/subscribe'),
};

// ── Health ─────────────────────────────────────────────────────────────────────

export interface HealthStatus {
  status: number;
  service: string;
  spatial_engine: boolean;
  version: string;
}

export const healthApi = {
  check: () =>
    http.get<HealthStatus>('/api/health'),
};
