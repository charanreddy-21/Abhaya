/**
 * API client methods for Safe Trip, Trusted Contacts, and SMS Fallback.
 *
 * Follows existing api-client.ts conventions:
 *   - All methods are async and throw typed errors
 *   - Error shape: { error: { code, message, details, "request-id" } }
 *   - camelCase fields on the client; mapping from dash-case happens here
 */

import type {
  SafeTrip,
  TripCreatePayload,
  TripExtendPayload,
  TrustedContact,
  ContactCreatePayload,
  ContactUpdatePayload,
} from "../types/features";
import { tokenStore } from "../lib/api-client";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(tokenStore.get() ? { Authorization: `Bearer ${tokenStore.get()}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = { error: { code: "NETWORK_ERROR", message: "Request failed." } };
    }
    throw body;
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ------------------------------------------------------------------ //
// Safe Trip                                                            //
// ------------------------------------------------------------------ //

export const tripApi = {
  create: (payload: TripCreatePayload): Promise<SafeTrip> =>
    apiFetch<SafeTripResponse>("/api/trips/", {
      method: "POST",
      body: JSON.stringify({
        destination_label: payload.destinationLabel,
        expected_arrival_at: payload.expectedArrivalAt,
        latitude: payload.latitude,
        longitude: payload.longitude,
      }),
    }).then(mapTrip),

  getActive: (): Promise<SafeTrip | null> =>
    apiFetch<SafeTripResponse | null>("/api/trips/active").then((trip) => trip ? mapTrip(trip) : null),

  list: (): Promise<{ trips: SafeTrip[]; total: number }> =>
    apiFetch<{ trips: SafeTripResponse[]; total: number }>("/api/trips/").then((page) => ({
      trips: page.trips.map(mapTrip),
      total: page.total,
    })),

  get: (tripId: string): Promise<SafeTrip> =>
    apiFetch<SafeTripResponse>(`/api/trips/${tripId}`).then(mapTrip),

  checkin: (tripId: string): Promise<SafeTrip> =>
    apiFetch<SafeTripResponse>(`/api/trips/${tripId}/checkin`, { method: "POST" }).then(mapTrip),

  extend: (tripId: string, payload: TripExtendPayload): Promise<SafeTrip> =>
    apiFetch<SafeTripResponse>(`/api/trips/${tripId}/extend`, {
      method: "POST",
      body: JSON.stringify({ extend_minutes: payload.extendMinutes }),
    }).then(mapTrip),

  cancel: (tripId: string): Promise<SafeTrip> =>
    apiFetch<SafeTripResponse>(`/api/trips/${tripId}/cancel`, { method: "POST" }).then(mapTrip),
};

// ------------------------------------------------------------------ //
// Trusted Contacts                                                     //
// ------------------------------------------------------------------ //

export const contactsApi = {
  list: (): Promise<TrustedContact[]> =>
    apiFetch<TrustedContactResponse[]>("/api/contacts/").then((contacts) => contacts.map(mapContact)),

  add: (payload: ContactCreatePayload): Promise<TrustedContact> =>
    apiFetch<TrustedContactResponse>("/api/contacts/", {
      method: "POST",
      body: JSON.stringify({
        name: payload.name,
        phone_number: payload.phoneNumber,
        channel: payload.channel,
      }),
    }).then(mapContact),

  update: (contactId: string, payload: ContactUpdatePayload): Promise<TrustedContact> =>
    apiFetch<TrustedContactResponse>(`/api/contacts/${contactId}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...(payload.name && { name: payload.name }),
        ...(payload.phoneNumber && { phone_number: payload.phoneNumber }),
        ...(payload.channel && { channel: payload.channel }),
      }),
    }).then(mapContact),

  remove: (contactId: string): Promise<void> =>
    apiFetch(`/api/contacts/${contactId}`, { method: "DELETE" }),
};

interface SafeTripResponse {
  id: string;
  user_id: string;
  destination_label: string;
  status: SafeTrip["status"];
  expected_arrival_at: string;
  ping_deadline_at: string | null;
  ping_sent_at: string | null;
  incident_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface TrustedContactResponse {
  id: string;
  user_id: string;
  name: string;
  phone_number_masked: string;
  channel: TrustedContact["channel"];
  created_at: string;
}

function mapTrip(trip: SafeTripResponse): SafeTrip {
  return {
    id: trip.id,
    userId: trip.user_id,
    destinationLabel: trip.destination_label,
    status: trip.status,
    expectedArrivalAt: trip.expected_arrival_at,
    pingDeadlineAt: trip.ping_deadline_at,
    pingSentAt: trip.ping_sent_at,
    incidentId: trip.incident_id,
    createdAt: trip.created_at,
    resolvedAt: trip.resolved_at,
  };
}

function mapContact(contact: TrustedContactResponse): TrustedContact {
  return {
    id: contact.id,
    userId: contact.user_id,
    name: contact.name,
    phoneNumberMasked: contact.phone_number_masked,
    channel: contact.channel,
    createdAt: contact.created_at,
  };
}
