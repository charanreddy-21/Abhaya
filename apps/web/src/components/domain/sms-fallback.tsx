"use client";

/**
 * SmsFallback — shown when the Abhaya API is unreachable.
 *
 * Integrates with offline-queue.ts: incident details are queued locally.
 * This component presents a native SMS compose link as the last resort.
 *
 * Design intent:
 * - Amber (degraded state) — not red (which is reserved for active SOS)
 * - Short, calm copy — no panic language
 * - One primary action: open native SMS app
 * - Secondary: retry the API
 */

import { useState, useEffect } from "react";
import { buildSmsUri, buildSosSmsFallbackBody } from "../../types/sms-utils";

interface SmsFallbackProps {
  /** Error object from a failed API call */
  apiError: unknown;
  /** Location from GeolocationAPI, if available */
  location?: { latitude: number; longitude: number } | null;
  /** Pre-filled recipient phone (first trusted contact, if known) */
  contactPhone?: string;
  /** Called when user successfully retries the API */
  onRetry: () => void | Promise<void>;
  /** Whether a retry is in progress */
  retrying?: boolean;
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && String(err.message).toLowerCase().includes("fetch")) {
    return true;
  }
  if (typeof err === "object" && err !== null) {
    const code = (err as { error?: { code?: string } }).error?.code;
    if (code === "NETWORK_ERROR" || code === "FETCH_FAILED") return true;
  }
  return false;
}

function isServerError(err: unknown): boolean {
  if (typeof err === "object" && err !== null) {
    const code = (err as { error?: { code?: string } }).error?.code;
    return typeof code === "string"; 
  }
  return false;
}

export default function SmsFallback({
  apiError,
  location,
  contactPhone,
  onRetry,
  retrying = false,
}: SmsFallbackProps) {
  const [smsUri, setSmsUri] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const body = buildSosSmsFallbackBody({
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
    });

    setSmsUri(
      buildSmsUri({
        body,
        to: contactPhone,
      })
    );
  }, [location, contactPhone]);

  const handleCopyText = async () => {
    if (!smsUri) return;
    const body = buildSosSmsFallbackBody({
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
    });
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — ignore silently as per calm design specs
    }
  };

  const isNetwork = isNetworkError(apiError);
  const hasStructuredError = isServerError(apiError);

  const errorMessage = (() => {
    if (isNetwork) return "Abhaya cannot reach the server right now.";
    if (hasStructuredError) {
      return (
        (apiError as { error?: { message?: string } })?.error?.message ??
        "Something went wrong."
      );
    }
    return "Something went wrong.";
  })();

  return (
    <div style={styles.container} role="status" aria-live="assertive">
      <div style={styles.statusRow}>
        <span style={styles.dot} aria-hidden />
        <span style={styles.statusLabel}>Network issue</span>
      </div>

      <p style={styles.message}>{errorMessage}</p>

      {isNetwork && (
        <p style={styles.hint}>
          Your SOS details have been saved on this device.
          Keep emergency contacts available and try again.
        </p>
      )}

      <div style={styles.actions}>
        <button
          onClick={onRetry}
          disabled={retrying}
          style={styles.retryButton}
          aria-label="Retry sending SOS"
        >
          {retrying ? "Retrying…" : "Try again"}
        </button>

        {isNetwork && smsUri && (
          <a
            href={smsUri}
            style={styles.smsButton}
            role="button"
            aria-label="Send SOS via SMS"
          >
            Send via SMS instead
          </a>
        )}
      </div>

      {isNetwork && smsUri && (
        <div style={styles.smsNote}>
          <p style={styles.noteText}>
            This opens your SMS app with your location and a message pre-filled.
            You'll need to tap Send.
          </p>
          <button
            onClick={handleCopyText}
            style={styles.copyButton}
            aria-label="Copy SMS message text"
          >
            {copied ? "Copied ✓" : "Copy message text"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Inline hook for detecting API failures ──────────────────────────── //

/**
 * useSmsFallback — wraps any async API call and tracks failure state.
 * Returns { error, retrying, retry, clearError }.
 *
 * Usage:
 * const { error, retrying, retry } = useSmsFallback(createSos);
 * if (error) return <SmsFallback apiError={error} onRetry={retry} />;
 */
export function useSmsFallback<Args extends any[], ReturnType>(
  apiFn: (...args: Args) => Promise<ReturnType>
) {
  const [error, setError] = useState<unknown>(null);
  const [retrying, setRetrying] = useState(false);
  const [lastArgs, setLastArgs] = useState<Args | null>(null);

  const call = async (...args: Args): Promise<ReturnType | null> => {
    setError(null);
    setLastArgs(args);
    try {
      return await apiFn(...args);
    } catch (err) {
      setError(err);
      return null;
    }
  };

  const retry = async (): Promise<ReturnType | null> => {
    if (!lastArgs) return null;
    setRetrying(true);
    setError(null);
    try {
      const result = await apiFn(...lastArgs);
      return result;
    } catch (err) {
      setError(err);
      return null;
    } finally {
      setRetrying(false);
    }
  };

  const clearError = () => setError(null);

  return { call, error, retrying, retry, clearError };
}

// ── Styles ─────────────────────────────────────────────────────────── //

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "#FFFBEB",
    border: "1px solid var(--amber, #F59E0B)",
    borderRadius: 8,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: 7,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "var(--amber, #F59E0B)",
    flexShrink: 0,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#92400E",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  message: {
    fontSize: 14,
    fontWeight: 500,
    color: "var(--ink, #111827)",
    margin: 0,
  },
  hint: {
    fontSize: 13,
    color: "var(--slate, #374151)",
    margin: 0,
    lineHeight: "18px",
  },
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  retryButton: {
    padding: "10px 16px",
    fontSize: 13,
    fontWeight: 600,
    background: "var(--mist, #F4F7F5)",
    border: "1px solid var(--line, #D8E0DC)",
    borderRadius: 8,
    cursor: "pointer",
    color: "var(--ink, #111827)",
    minHeight: 40,
  },
  smsButton: {
    padding: "10px 16px",
    fontSize: 13,
    fontWeight: 600,
    background: "var(--amber, #F59E0B)",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    color: "#111827",
    minHeight: 40,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
  },
  smsNote: {
    borderTop: "1px solid #FDE68A",
    paddingTop: 10,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  noteText: {
    fontSize: 12,
    color: "var(--slate, #374151)",
    margin: 0,
    lineHeight: "17px",
  },
  copyButton: {
    padding: "6px 10px",
    fontSize: 12,
    background: "transparent",
    border: "1px solid #FDE68A",
    borderRadius: 6,
    cursor: "pointer",
    color: "#92400E",
    alignSelf: "flex-start",
  },
};