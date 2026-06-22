// ── Shared domain types matching FastAPI response schemas ──────────────────────

export interface ApiError {
  code: string;
  message: string;
  details: Record<string, unknown>;
  request_id: string;
}

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: 'user' | 'admin';
  witness_opt_in: boolean;
  anonymous_by_default: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
}

export interface AuthResponse {
  user: User;
  token: TokenResponse;
}

// ── Incidents ──────────────────────────────────────────────────────────────────

export type IncidentStatus = 'active' | 'resolved';

export interface Incident {
  id: string;
  status: IncidentStatus;
  approx_lat: number;
  approx_lng: number;
  accuracy_meters: number;
  witness_alert_count: number;
  evidence_count: number;
  elapsed_seconds: number;
  created_at: string;
  resolved_at: string | null;
}

export interface CreateSOSPayload {
  lat: number;
  lng: number;
  accuracy_meters?: number;
}

// ── Witness Alerts ─────────────────────────────────────────────────────────────

export type WitnessAlertStatus = 'pending' | 'alerted' | 'acknowledged' | 'revealed';

export interface WitnessAlert {
  id: string;
  incident_id: string;
  status: WitnessAlertStatus;
  approx_distance_meters: number;
  incident_approx_lat: number;
  incident_approx_lng: number;
  incident_created_at: string;
  acknowledged_at: string | null;
  revealed_at: string | null;
  witness_display_name: string | null;
}

// ── Evidence ───────────────────────────────────────────────────────────────────

export type EvidenceKind = 'video' | 'audio' | 'photo';
export type EvidenceUploadStatus = 'pending' | 'uploaded' | 'failed';

export interface EvidenceItem {
  id: string;
  incident_id: string;
  kind: EvidenceKind;
  label: string;
  size_bytes: number;
  sha256_hash: string;
  anchored: boolean;
  upload_status: EvidenceUploadStatus;
  created_at: string;
}

// ── Safe Places ────────────────────────────────────────────────────────────────

export type SafePlaceKind = 'police' | 'hospital' | 'pharmacy' | 'petrol' | 'shelter';
export type VerificationLevel = 'unverified' | 'community' | 'admin';

export interface SafePlace {
  id: string;
  name: string;
  kind: SafePlaceKind;
  lat: number;
  lng: number;
  address: string;
  is_open: boolean;
  verification_level: VerificationLevel;
  distance_meters: number | null;
}

// ── Admin ──────────────────────────────────────────────────────────────────────

export interface AdminIncident {
  id: string;
  display_id: string;
  status: IncidentStatus;
  user_display_name: string;
  approx_lat: number;
  approx_lng: number;
  accuracy_meters: number;
  witness_alert_count: number;
  witness_ack_count: number;
  evidence_count: number;
  elapsed_seconds: number;
  created_at: string;
  resolved_at: string | null;
}

export interface AdminWitness {
  id: string;
  label: string;
  status: WitnessAlertStatus;
  approx_distance_meters: number;
  revealed: boolean;
  display_name: string | null;
}

export interface AdminEvidence {
  id: string;
  kind: EvidenceKind;
  label: string;
  size_bytes: number;
  sha256_hash: string;
  anchored: boolean;
  upload_status: EvidenceUploadStatus;
}

export interface AdminAuditEvent {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  actor_label: string;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogPage {
  events: AdminAuditEvent[];
  total: number;
  offset: number;
  limit: number;
}

export interface AdminIncidentDetail {
  incident: AdminIncident;
  witnesses: AdminWitness[];
  evidence: AdminEvidence[];
  timeline: AdminAuditEvent[];
}

export interface SystemMetrics {
  active_incidents: number;
  total_incidents: number;
  total_users: number;
  total_evidence: number;
  total_safe_places: number;
  db_status: string;
}

// ── Utility ────────────────────────────────────────────────────────────────────

export interface UpdateProfilePayload {
  display_name?: string;
  witness_opt_in?: boolean;
  anonymous_by_default?: boolean;
}

export interface CreateSafePlacePayload {
  name: string;
  kind: SafePlaceKind;
  lat: number;
  lng: number;
  address?: string;
  is_open?: boolean;
}
