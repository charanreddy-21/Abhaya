// ------------------------------------------------------------------ //
// Safe Trip types                                                       //
// ------------------------------------------------------------------ //

export type TripStatus =
  | "active"
  | "pending_checkin"
  | "extended"
  | "resolved"
  | "escalated"
  | "cancelled";

export interface SafeTrip {
  id: string;
  userId: string;
  destinationLabel: string;
  status: TripStatus;
  expectedArrivalAt: string; // ISO 8601
  pingDeadlineAt: string | null;
  pingSentAt: string | null;
  incidentId: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface TripCreatePayload {
  destinationLabel: string;
  expectedArrivalAt: string;
  latitude?: number;
  longitude?: number;
}

export interface TripExtendPayload {
  extendMinutes: 5 | 10 | 15 | 30 | 60;
}

// ------------------------------------------------------------------ //
// Trusted Contact types                                                //
// ------------------------------------------------------------------ //

export type ContactChannel = "whatsapp" | "sms";

export interface TrustedContact {
  id: string;
  userId: string;
  name: string;
  phoneNumberMasked: string; // "+91 ••••••7890"
  channel: ContactChannel;
  createdAt: string;
}

export interface ContactCreatePayload {
  name: string;
  phoneNumber: string;
  channel: ContactChannel;
}

export interface ContactUpdatePayload {
  name?: string;
  phoneNumber?: string;
  channel?: ContactChannel;
}

export interface EchoDispatchResult {
  contactId: string;
  contactName: string;
  channel: ContactChannel;
  delivered: boolean;
  error?: string;
}

// ------------------------------------------------------------------ //
// SMS Fallback (Low-Bandwidth mode)                                    //
// ------------------------------------------------------------------ //

export interface SmsFallbackPayload {
  body: string;
  /** pre-filled recipient (trusted contact phone) if available */
  to?: string;
}

// /**
//  * Build an sms:// URI for native SMS compose fallback.
//  * Works on Android and iOS PWA.
//  */
// export function buildSmsUri(payload: SmsFallbackPayload): string {
//   const encoded = encodeURIComponent(payload.body);
//   if (payload.to) {
//     // Android uses ?body=, iOS uses &body=
//     return `sms:${payload.to}?body=${encoded}`;
//   }
//   return `sms:?body=${encoded}`;
// }

// /**
//  * Build a pre-filled SOS SMS body from location and timestamp.
//  */
// export function buildSosSmsFallbackBody(opts: {
//   latitude: number | null;
//   longitude: number | null;
//   timestamp?: string;
// }): string {
//   const { latitude, longitude, timestamp } = opts;
//   const time = timestamp ?? new Date().toLocaleTimeString("en-IN", {
//     hour: "2-digit",
//     minute: "2-digit",
//     timeZone: "Asia/Kolkata",
//   });

//   const locationPart =
//     latitude !== null && longitude !== null
//       ? `Location: https://maps.google.com/?q=${latitude},${longitude}`
//       : "Location: unavailable";

//   return (
//     `🚨 ABHAYA SOS ALERT\n\n` +
//     `I need help. This is an emergency.\n` +
//     `${locationPart}\n` +
//     `Time: ${time} IST\n\n` +
//     `Sent via Abhaya safety app.`
//   );
// }