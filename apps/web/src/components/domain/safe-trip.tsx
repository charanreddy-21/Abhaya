"use client";

/**
 * SafeTrip — Trip monitoring component.
 *
 * States rendered:
 *   idle           → "Start a Safe Trip" form
 *   active         → countdown timer + extend/cancel controls
 *   pending_checkin → Safety Ping screen (2-min grace window)
 *   escalated      → "Alert sent" state, link to SOS screen
 *   resolved       → Quiet confirmation
 *   cancelled      → Quiet confirmation
 *
 * Design rules (from DESIGN_SYSTEM.md):
 *   - Amber for pending/degraded state
 *   - Red ONLY for escalated (actual emergency)
 *   - Forest/green for resolved
 *   - One primary action per screen section
 *   - Short, plain-language copy — no jargon
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { SafeTrip, TripCreatePayload } from "../../types/features";
import { tripApi } from "../../types/features-api";

// ── Utility ────────────────────────────────────────────────────────── //

function formatCountdown(targetIso: string): string {
  const target = new Date(targetIso).getTime();
  const now = Date.now();
  const diff = Math.max(0, Math.floor((target - now) / 1000));

  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;

  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

function formatEta(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

const EXTEND_OPTIONS: Array<{ value: 5 | 10 | 15 | 30 | 60; label: string }> = [
  { value: 5, label: "+5 min" },
  { value: 10, label: "+10 min" },
  { value: 15, label: "+15 min" },
  { value: 30, label: "+30 min" },
  { value: 60, label: "+1 hr" },
];

// ── Sub-components ─────────────────────────────────────────────────── //

function StatusDot({ status }: { status: SafeTrip["status"] }) {
  const map: Record<SafeTrip["status"], string> = {
    active: "var(--forest, #1F6F50)",
    pending_checkin: "var(--amber, #F59E0B)",
    extended: "var(--forest, #1F6F50)",
    resolved: "var(--forest, #1F6F50)",
    escalated: "var(--red, #E11D48)",
    cancelled: "var(--slate, #374151)",
  };
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: map[status],
        flexShrink: 0,
      }}
      aria-hidden
    />
  );
}

function StatusLabel({ status }: { status: SafeTrip["status"] }) {
  const labels: Record<SafeTrip["status"], string> = {
    active: "Trip active",
    pending_checkin: "Check-in needed",
    extended: "Timer extended",
    resolved: "Checked in safely",
    escalated: "Alert sent",
    cancelled: "Trip cancelled",
  };
  return <span>{labels[status]}</span>;
}

// ── Main component ─────────────────────────────────────────────────── //

interface SafeTripProps {
  /** Called when an escalation creates an SOS incident */
  onEscalated?: (incidentId: string | null) => void;
}

export default function SafeTripPanel({ onEscalated }: SafeTripProps) {
  const [trip, setTrip] = useState<SafeTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string>("");
  const [pingCountdown, setPingCountdown] = useState<string>("");
  const [extending, setExtending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Form state
  const [destination, setDestination] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // ── Load active trip on mount ─────────────────────────────────────── //
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const active = await tripApi.getActive();
        if (!cancelled) setTrip(active);
      } catch {
        // No active trip is fine; ignore error
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Countdown ticker ──────────────────────────────────────────────── //
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);

    if (!trip) return;

    const tick = () => {
      if (trip.status === "active" || trip.status === "extended") {
        setCountdown(formatCountdown(trip.expectedArrivalAt));
      } else if (trip.status === "pending_checkin" && trip.pingDeadlineAt) {
        setPingCountdown(formatCountdown(trip.pingDeadlineAt));
      }
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [trip]);

  // Poll while a trip is live so backend timer transitions show up after refresh or ETA.
  useEffect(() => {
    if (!trip || !["active", "extended", "pending_checkin"].includes(trip.status)) return;
    const interval = setInterval(async () => {
      if (!trip) return;
      try {
        const updated = await tripApi.get(trip.id);
        setTrip(updated);
        if (updated.status === "escalated") {
          onEscalated?.(updated.incidentId);
        }
      } catch { /* network hiccup — try again next tick */ }
    }, 15_000);
    return () => clearInterval(interval);
  }, [trip, onEscalated]);

  // ── Actions ───────────────────────────────────────────────────────── //

  const handleCreate = async () => {
    setFormError(null);
    if (!destination.trim()) {
      setFormError("Enter a destination.");
      return;
    }
    if (!arrivalDate || !arrivalTime) {
      setFormError("Set your expected arrival time.");
      return;
    }

    const iso = new Date(`${arrivalDate}T${arrivalTime}:00`).toISOString();
    if (new Date(iso) <= new Date()) {
      setFormError("Arrival time must be in the future.");
      return;
    }

    setSubmitting(true);
    setError(null);

    let latitude: number | undefined;
    let longitude: number | undefined;

    // Best-effort geolocation
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
      );
      latitude = pos.coords.latitude;
      longitude = pos.coords.longitude;
    } catch { /* non-critical */ }

    try {
      const created = await tripApi.create({
        destinationLabel: destination.trim(),
        expectedArrivalAt: iso,
        latitude,
        longitude,
      });
      setTrip(created);
      setDestination("");
      setArrivalDate("");
      setArrivalTime("");
    } catch (err: unknown) {
      const msg =
        (err as { error?: { message?: string } })?.error?.message ??
        "We couldn't start the trip. Try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckin = async () => {
    if (!trip) return;
    setSubmitting(true);
    try {
      const updated = await tripApi.checkin(trip.id);
      setTrip(updated);
    } catch (err: unknown) {
      const msg =
        (err as { error?: { message?: string } })?.error?.message ??
        "Check-in failed. Try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExtend = async (minutes: 5 | 10 | 15 | 30 | 60) => {
    if (!trip) return;
    setExtending(false);
    setSubmitting(true);
    try {
      const updated = await tripApi.extend(trip.id, { extendMinutes: minutes });
      setTrip(updated);
    } catch (err: unknown) {
      const msg =
        (err as { error?: { message?: string } })?.error?.message ??
        "Couldn't extend the timer. Try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!trip) return;
    if (!confirm("Cancel this Safe Trip?")) return;
    setSubmitting(true);
    try {
      const updated = await tripApi.cancel(trip.id);
      setTrip(updated);
    } catch (err: unknown) {
      const msg =
        (err as { error?: { message?: string } })?.error?.message ??
        "Couldn't cancel the trip. Try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartNew = () => {
    setTrip(null);
    setError(null);
  };

  // ── Min datetime for the input ────────────────────────────────────── //
  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

  // ── Render ─────────────────────────────────────────────────────────── //

  if (loading) {
    return (
      <div style={styles.panel} aria-busy="true">
        <span style={styles.loadingText}>Loading trip status…</span>
      </div>
    );
  }

  // ── No active trip: show form ───────────────────────────────────────── //
  if (!trip || trip.status === "cancelled" || trip.status === "resolved") {
    const wasResolved = trip?.status === "resolved";
    const wasCancelled = trip?.status === "cancelled";

    return (
      <section style={styles.panel} aria-label="Safe Trip">
        {wasResolved && (
          <div style={styles.resolvedBanner} role="status">
            <span style={styles.resolvedIcon} aria-hidden>✓</span>
            You checked in safely.
          </div>
        )}
        {wasCancelled && (
          <div style={styles.cancelledBanner} role="status">
            Trip was cancelled.
          </div>
        )}

        <h2 style={styles.heading}>Safe Trip</h2>
        <p style={styles.body}>
          Set your destination and arrival time. If you don't check in,
          Abhaya can prompt you and notify trusted contacts when configured.
        </p>

        <div style={styles.field}>
          <label htmlFor="trip-destination" style={styles.label}>
            Where are you going?
          </label>
          <input
            id="trip-destination"
            type="text"
            placeholder="e.g. Home, Koramangala Metro"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            style={styles.input}
            maxLength={120}
            autoComplete="off"
            disabled={submitting}
          />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ ...styles.field, flex: 1, minWidth: 130 }}>
            <label htmlFor="trip-date" style={styles.label}>Date</label>
            <input
              id="trip-date"
              type="date"
              value={arrivalDate}
              min={nowLocal}
              onChange={(e) => setArrivalDate(e.target.value)}
              style={styles.input}
              disabled={submitting}
            />
          </div>
          <div style={{ ...styles.field, flex: 1, minWidth: 110 }}>
            <label htmlFor="trip-time" style={styles.label}>Arrival time</label>
            <input
              id="trip-time"
              type="time"
              value={arrivalTime}
              onChange={(e) => setArrivalTime(e.target.value)}
              style={styles.input}
              disabled={submitting}
            />
          </div>
        </div>

        {formError && <p style={styles.errorText} role="alert">{formError}</p>}
        {error && <p style={styles.errorText} role="alert">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={submitting}
          style={styles.primaryButton}
          aria-label="Start Safe Trip monitoring"
        >
          {submitting ? "Starting…" : "Start Safe Trip"}
        </button>
      </section>
    );
  }

  // ── Escalated ─────────────────────────────────────────────────────── //
  if (trip.status === "escalated") {
    return (
      <section style={{ ...styles.panel, ...styles.escalatedPanel }} aria-label="Trip escalated">
        <div style={styles.escalatedIcon} aria-hidden>⚠</div>
        <h2 style={{ ...styles.heading, color: "var(--red, #E11D48)" }}>
          Alert sent
        </h2>
        <p style={styles.body}>
          You didn't respond to the safety check-in. Abhaya has started the
          configured escalation steps.
        </p>
        {trip.incidentId && (
          <a href="/sos/active" style={styles.primaryButton} role="button">
            View safety status
          </a>
        )}
        <button onClick={handleStartNew} style={styles.ghostButton}>
          Start a new trip
        </button>
      </section>
    );
  }

  // ── Pending check-in (Safety Ping) ────────────────────────────────── //
  if (trip.status === "pending_checkin") {
    return (
      <section
        style={{ ...styles.panel, ...styles.pingPanel }}
        aria-label="Safety check-in needed"
        aria-live="assertive"
      >
        <div style={styles.pingTimerRing} aria-hidden>
          <span style={styles.pingTimerText}>{pingCountdown || "2:00"}</span>
        </div>

        <h2 style={{ ...styles.heading, color: "var(--amber, #F59E0B)" }}>
          Are you safe?
        </h2>
        <p style={styles.body}>
          Your trip to <strong>{trip.destinationLabel}</strong> is overdue.
          Tap "I'm safe" within the timer or Abhaya will start escalation.
        </p>

        {error && <p style={styles.errorText} role="alert">{error}</p>}

        <button
          onClick={handleCheckin}
          disabled={submitting}
          style={styles.primaryButton}
          aria-label="Confirm you are safe"
        >
          {submitting ? "Saving…" : "I'm safe ✓"}
        </button>

        <div style={styles.extendRow}>
          <span style={styles.label}>Stuck in traffic?</span>
          {EXTEND_OPTIONS.slice(0, 3).map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleExtend(opt.value)}
              disabled={submitting}
              style={styles.chipButton}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>
    );
  }

  // ── Active trip ───────────────────────────────────────────────────── //
  return (
    <section style={styles.panel} aria-label="Active Safe Trip">
      <div style={styles.tripHeader}>
        <div style={styles.statusRow}>
          <StatusDot status={trip.status} />
          <span style={styles.statusText}>
            <StatusLabel status={trip.status} />
          </span>
        </div>
        <span style={styles.destination}>{trip.destinationLabel}</span>
      </div>

      <div style={styles.timerBlock} aria-live="polite" aria-label="Time remaining">
        <span style={styles.timerValue}>{countdown}</span>
        <span style={styles.timerLabel}>
          ETA {formatEta(trip.expectedArrivalAt)}
        </span>
      </div>

      <p style={styles.hintText}>
        If you don't check in by then, Abhaya starts a check-in window. You'll
        have 2 minutes to respond before escalation starts.
      </p>

      {error && <p style={styles.errorText} role="alert">{error}</p>}

      <button
        onClick={handleCheckin}
        disabled={submitting}
        style={styles.primaryButton}
        aria-label="Check in safely"
      >
        {submitting ? "Saving…" : "I arrived safely ✓"}
      </button>

      {extending ? (
        <div style={styles.extendOptions} role="group" aria-label="Extend arrival time">
          <span style={styles.label}>Add how much time?</span>
          <div style={styles.chipRow}>
            {EXTEND_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleExtend(opt.value)}
                disabled={submitting}
                style={styles.chipButton}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setExtending(false)}
            style={styles.ghostButton}
            aria-label="Cancel extend"
          >
            Never mind
          </button>
        </div>
      ) : (
        <div style={styles.secondaryRow}>
          <button
            onClick={() => setExtending(true)}
            disabled={submitting}
            style={styles.secondaryButton}
          >
            Running late
          </button>
          <button
            onClick={handleCancel}
            disabled={submitting}
            style={styles.destructiveButton}
          >
            Cancel trip
          </button>
        </div>
      )}
    </section>
  );
}

// ── Styles ─────────────────────────────────────────────────────────── //
// Using inline styles that reference CSS custom properties from globals.css

const styles: Record<string, React.CSSProperties> = {
  panel: {
    background: "var(--paper, #FFFFFF)",
    border: "1px solid var(--line, #D8E0DC)",
    borderRadius: 8,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  escalatedPanel: {
    borderColor: "var(--red, #E11D48)",
    background: "var(--soft-rose, #FFF1F2)",
    alignItems: "center",
    textAlign: "center",
  },
  pingPanel: {
    borderColor: "var(--amber, #F59E0B)",
    alignItems: "center",
    textAlign: "center",
  },
  resolvedBanner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#F0FDF4",
    border: "1px solid #BBF7D0",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 14,
    color: "var(--forest, #1F6F50)",
  },
  resolvedIcon: { fontSize: 16, fontWeight: 600 },
  cancelledBanner: {
    background: "var(--mist, #F4F7F5)",
    border: "1px solid var(--line, #D8E0DC)",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 14,
    color: "var(--slate, #374151)",
  },
  heading: {
    fontSize: 20,
    fontWeight: 700,
    lineHeight: "28px",
    color: "var(--ink, #111827)",
    margin: 0,
  },
  body: {
    fontSize: 15,
    lineHeight: "22px",
    color: "var(--slate, #374151)",
    margin: 0,
  },
  hintText: {
    fontSize: 13,
    lineHeight: "20px",
    color: "var(--slate, #374151)",
    margin: 0,
    opacity: 0.8,
  },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, fontWeight: 500, color: "var(--slate, #374151)" },
  input: {
    padding: "10px 12px",
    fontSize: 15,
    borderRadius: 8,
    border: "1px solid var(--line, #D8E0DC)",
    background: "var(--mist, #F4F7F5)",
    color: "var(--ink, #111827)",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  errorText: {
    fontSize: 13,
    color: "var(--red, #E11D48)",
    margin: 0,
    fontWeight: 500,
  },
  primaryButton: {
    padding: "14px 20px",
    fontSize: 16,
    fontWeight: 600,
    background: "var(--forest, #1F6F50)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    minHeight: 48,
    display: "block",
    width: "100%",
    textAlign: "center",
    textDecoration: "none",
    letterSpacing: 0,
  },
  secondaryButton: {
    flex: 1,
    padding: "12px 16px",
    fontSize: 14,
    fontWeight: 500,
    background: "var(--mist, #F4F7F5)",
    color: "var(--slate, #374151)",
    border: "1px solid var(--line, #D8E0DC)",
    borderRadius: 8,
    cursor: "pointer",
    minHeight: 44,
  },
  destructiveButton: {
    flex: 1,
    padding: "12px 16px",
    fontSize: 14,
    fontWeight: 500,
    background: "transparent",
    color: "var(--red, #E11D48)",
    border: "1px solid var(--red, #E11D48)",
    borderRadius: 8,
    cursor: "pointer",
    minHeight: 44,
  },
  ghostButton: {
    padding: "10px",
    fontSize: 14,
    background: "transparent",
    color: "var(--slate, #374151)",
    border: "none",
    cursor: "pointer",
    textDecoration: "underline",
  },
  secondaryRow: { display: "flex", gap: 10 },
  chipButton: {
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 500,
    background: "var(--mist, #F4F7F5)",
    border: "1px solid var(--line, #D8E0DC)",
    borderRadius: 999,
    cursor: "pointer",
    color: "var(--ink, #111827)",
    minHeight: 36,
  },
  chipRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  extendRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  extendOptions: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: "12px 0",
    borderTop: "1px solid var(--line, #D8E0DC)",
  },
  tripHeader: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 500,
    color: "var(--slate, #374151)",
    letterSpacing: "0.02em",
    textTransform: "uppercase",
  },
  destination: {
    fontSize: 18,
    fontWeight: 700,
    color: "var(--ink, #111827)",
  },
  timerBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 2,
    padding: "16px 0",
    borderTop: "1px solid var(--line, #D8E0DC)",
    borderBottom: "1px solid var(--line, #D8E0DC)",
  },
  timerValue: {
    fontSize: 40,
    fontWeight: 700,
    lineHeight: "48px",
    color: "var(--ink, #111827)",
    fontVariantNumeric: "tabular-nums",
  },
  timerLabel: {
    fontSize: 13,
    color: "var(--slate, #374151)",
  },
  loadingText: {
    fontSize: 14,
    color: "var(--slate, #374151)",
  },
  pingTimerRing: {
    width: 96,
    height: 96,
    borderRadius: "50%",
    border: "3px solid var(--amber, #F59E0B)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  pingTimerText: {
    fontSize: 22,
    fontWeight: 700,
    color: "var(--amber, #F59E0B)",
    fontVariantNumeric: "tabular-nums",
  },
  escalatedIcon: {
    fontSize: 32,
    color: "var(--red, #E11D48)",
  },
};
