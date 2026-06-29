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

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    credentials: "include",
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
    apiFetch("/api/trips", {
      method: "POST",
      body: JSON.stringify({
        destination_label: payload.destinationLabel,
        expected_arrival_at: payload.expectedArrivalAt,
        latitude: payload.latitude,
        longitude: payload.longitude,
      }),
    }),

  getActive: (): Promise<SafeTrip | null> =>
    apiFetch("/api/trips/active"),

  list: (): Promise<{ trips: SafeTrip[]; total: number }> =>
    apiFetch("/api/trips"),

  get: (tripId: string): Promise<SafeTrip> =>
    apiFetch(`/api/trips/${tripId}`),

  checkin: (tripId: string): Promise<SafeTrip> =>
    apiFetch(`/api/trips/${tripId}/checkin`, { method: "POST" }),

  extend: (tripId: string, payload: TripExtendPayload): Promise<SafeTrip> =>
    apiFetch(`/api/trips/${tripId}/extend`, {
      method: "POST",
      body: JSON.stringify({ extend_minutes: payload.extendMinutes }),
    }),

  cancel: (tripId: string): Promise<SafeTrip> =>
    apiFetch(`/api/trips/${tripId}/cancel`, { method: "POST" }),
};

// ------------------------------------------------------------------ //
// Trusted Contacts                                                     //
// ------------------------------------------------------------------ //

export const contactsApi = {
  list: (): Promise<TrustedContact[]> =>
    apiFetch("/api/contacts"),

  add: (payload: ContactCreatePayload): Promise<TrustedContact> =>
    apiFetch("/api/contacts", {
      method: "POST",
      body: JSON.stringify({
        name: payload.name,
        phone_number: payload.phoneNumber,
        channel: payload.channel,
      }),
    }),

  update: (contactId: string, payload: ContactUpdatePayload): Promise<TrustedContact> =>
    apiFetch(`/api/contacts/${contactId}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...(payload.name && { name: payload.name }),
        ...(payload.phoneNumber && { phone_number: payload.phoneNumber }),
        ...(payload.channel && { channel: payload.channel }),
      }),
    }),

  remove: (contactId: string): Promise<void> =>
    apiFetch(`/api/contacts/${contactId}`, { method: "DELETE" }),
};