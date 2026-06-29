export interface SmsFallbackPayload {
  body: string;
  to?: string;
}

export function buildSmsUri(payload: SmsFallbackPayload): string {
  const encoded = encodeURIComponent(payload.body);
  if (payload.to) {
    return `sms:${payload.to}?body=${encoded}`;
  }
  return `sms:?body=${encoded}`;
}

export function buildSosSmsFallbackBody(opts: {
  latitude: number | null;
  longitude: number | null;
  timestamp?: string;
}): string {
  const { latitude, longitude, timestamp } = opts;
  const time = timestamp ?? new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

  const locationPart =
    latitude !== null && longitude !== null
      ? `Location: https://maps.google.com/?q=${latitude},${longitude}`
      : "Location: unavailable";

  return (
    `🚨 ABHAYA SOS ALERT\n\n` +
    `I need help. This is an emergency.\n` +
    `${locationPart}\n` +
    `Time: ${time} IST\n\n` +
    `Sent via Abhaya safety app.`
  );
}