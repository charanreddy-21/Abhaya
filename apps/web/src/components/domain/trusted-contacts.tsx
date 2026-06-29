"use client";

/**
 * TrustedContacts — manage emergency contacts.
 *
 * Design rules:
 *   - Max 5 contacts shown as a compact list, not heavy cards
 *   - Channel badge: WhatsApp (teal), SMS (slate)
 *   - Phone numbers always masked — raw number never rendered
 *   - Destructive delete requires confirmation
 *   - Add form is inline, not a modal
 */

import { useState, useEffect } from "react";
import type {
  TrustedContact,
  ContactCreatePayload,
  ContactChannel,
} from "../../types/features";
import { contactsApi } from "../../types/features-api";

const MAX_CONTACTS = 5;

const CHANNEL_LABELS: Record<ContactChannel, string> = {
  whatsapp: "WhatsApp",
  sms: "SMS",
};

const CHANNEL_COLORS: Record<ContactChannel, string> = {
  whatsapp: "var(--trust-teal, #0F766E)",
  sms: "var(--slate, #374151)",
};

// ── Sub-components ─────────────────────────────────────────────────── //

function ContactRow({
  contact,
  onDelete,
  deleting,
}: {
  contact: TrustedContact;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const [confirm, setConfirm] = useState(false);

  return (
    <div style={styles.contactRow}>
      <div style={styles.contactAvatar} aria-hidden>
        {contact.name.charAt(0).toUpperCase()}
      </div>
      <div style={styles.contactInfo}>
        <span style={styles.contactName}>{contact.name}</span>
        <span style={styles.contactPhone}>{contact.phoneNumberMasked}</span>
      </div>
      <span
        style={{
          ...styles.channelBadge,
          color: CHANNEL_COLORS[contact.channel],
          borderColor: CHANNEL_COLORS[contact.channel],
        }}
      >
        {CHANNEL_LABELS[contact.channel]}
      </span>

      {confirm ? (
        <div style={styles.confirmRow}>
          <button
            onClick={() => onDelete(contact.id)}
            disabled={deleting}
            style={styles.deleteConfirmButton}
            aria-label={`Confirm remove ${contact.name}`}
          >
            {deleting ? "…" : "Remove"}
          </button>
          <button
            onClick={() => setConfirm(false)}
            style={styles.ghostButton}
            aria-label="Keep contact"
          >
            Keep
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirm(true)}
          style={styles.iconButton}
          aria-label={`Remove ${contact.name}`}
          title="Remove contact"
        >
          ×
        </button>
      )}
    </div>
  );
}

function AddContactForm({
  onAdd,
  disabled,
}: {
  onAdd: (payload: ContactCreatePayload) => Promise<void>;
  disabled: boolean;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<ContactChannel>("whatsapp");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    const trimName = name.trim();
    const trimPhone = phone.trim().replace(/\s|-/g, "");

    if (!trimName) { setError("Enter a name."); return; }
    if (!/^\+?[1-9]\d{7,14}$/.test(trimPhone)) {
      setError("Enter a valid phone number with country code, e.g. +919876543210.");
      return;
    }

    setSubmitting(true);
    try {
      await onAdd({ name: trimName, phoneNumber: trimPhone, channel });
      setName("");
      setPhone("");
      setChannel("whatsapp");
      setOpen(false);
    } catch (err: unknown) {
      const msg =
        (err as { error?: { message?: string } })?.error?.message ??
        "Couldn't add contact. Try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={styles.addButton}
        disabled={disabled}
        aria-label="Add trusted contact"
      >
        + Add contact
      </button>
    );
  }

  return (
    <div style={styles.addForm}>
      <div style={styles.field}>
        <label htmlFor="contact-name" style={styles.label}>Name</label>
        <input
          id="contact-name"
          type="text"
          placeholder="Mum, Priya, etc."
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={styles.input}
          maxLength={80}
          disabled={submitting}
        />
      </div>

      <div style={styles.field}>
        <label htmlFor="contact-phone" style={styles.label}>Phone number</label>
        <input
          id="contact-phone"
          type="tel"
          placeholder="+919876543210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={styles.input}
          disabled={submitting}
          autoComplete="tel"
        />
        <span style={styles.hint}>Include country code. e.g. +91 for India.</span>
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Notify via</label>
        <div style={styles.channelRow} role="radiogroup" aria-label="Notification channel">
          {(["whatsapp", "sms"] as ContactChannel[]).map((ch) => (
            <label key={ch} style={styles.channelOption}>
              <input
                type="radio"
                name="channel"
                value={ch}
                checked={channel === ch}
                onChange={() => setChannel(ch)}
                style={{ accentColor: CHANNEL_COLORS[ch] }}
              />
              {CHANNEL_LABELS[ch]}
            </label>
          ))}
        </div>
        {channel === "whatsapp" && (
          <span style={styles.hint}>
            The contact must have WhatsApp active on this number.
          </span>
        )}
      </div>

      {error && <p style={styles.errorText} role="alert">{error}</p>}

      <div style={styles.formActions}>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={styles.primaryButton}
        >
          {submitting ? "Saving…" : "Save contact"}
        </button>
        <button
          onClick={() => { setOpen(false); setError(null); }}
          style={styles.ghostButton}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────── //

export default function TrustedContacts() {
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await contactsApi.list();
        if (!cancelled) setContacts(list);
      } catch {
        if (!cancelled) setError("Couldn't load contacts.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleAdd = async (payload: ContactCreatePayload) => {
    const created = await contactsApi.add(payload);
    setContacts((prev) => [...prev, created]);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await contactsApi.remove(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError("Couldn't remove contact. Try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const atLimit = contacts.length >= MAX_CONTACTS;

  return (
    <section style={styles.panel} aria-label="Trusted contacts">
      <div style={styles.panelHeader}>
        <div>
          <h2 style={styles.heading}>Trusted contacts</h2>
          <p style={styles.subheading}>
            These people are notified if you trigger an SOS or miss a Safe Trip
            check-in.
          </p>
        </div>
        <span style={styles.countBadge} aria-label={`${contacts.length} of ${MAX_CONTACTS} contacts`}>
          {contacts.length}/{MAX_CONTACTS}
        </span>
      </div>

      {loading && (
        <p style={styles.muted} aria-busy>Loading…</p>
      )}

      {!loading && contacts.length === 0 && (
        <div style={styles.emptyState}>
          <p style={styles.muted}>No contacts yet.</p>
          <p style={styles.hint}>
            Add at least one person who should be contacted in an emergency.
          </p>
        </div>
      )}

      {!loading && contacts.length > 0 && (
        <div style={styles.contactList} role="list">
          {contacts.map((c) => (
            <div key={c.id} role="listitem">
              <ContactRow
                contact={c}
                onDelete={handleDelete}
                deleting={deletingId === c.id}
              />
            </div>
          ))}
        </div>
      )}

      {error && <p style={styles.errorText} role="alert">{error}</p>}

      {!atLimit && !loading && (
        <AddContactForm onAdd={handleAdd} disabled={atLimit} />
      )}

      {atLimit && (
        <p style={styles.hint}>
          You've reached the maximum of {MAX_CONTACTS} contacts.
        </p>
      )}
    </section>
  );
}

// ── Styles ─────────────────────────────────────────────────────────── //

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
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  heading: {
    fontSize: 18,
    fontWeight: 700,
    color: "var(--ink, #111827)",
    margin: 0,
  },
  subheading: {
    fontSize: 13,
    color: "var(--slate, #374151)",
    margin: "4px 0 0",
    lineHeight: "18px",
  },
  countBadge: {
    fontSize: 12,
    fontWeight: 500,
    color: "var(--slate, #374151)",
    background: "var(--mist, #F4F7F5)",
    border: "1px solid var(--line, #D8E0DC)",
    borderRadius: 999,
    padding: "3px 9px",
    whiteSpace: "nowrap",
  },
  contactList: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
    border: "1px solid var(--line, #D8E0DC)",
    borderRadius: 8,
    overflow: "hidden",
  },
  contactRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    borderBottom: "1px solid var(--line, #D8E0DC)",
    background: "var(--paper, #FFFFFF)",
  },
  contactAvatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "var(--mist, #F4F7F5)",
    border: "1px solid var(--line, #D8E0DC)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 15,
    fontWeight: 600,
    color: "var(--slate, #374151)",
    flexShrink: 0,
  },
  contactInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    flex: 1,
    minWidth: 0,
  },
  contactName: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--ink, #111827)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  contactPhone: {
    fontSize: 12,
    color: "var(--slate, #374151)",
    fontFamily: "monospace",
  },
  channelBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 7px",
    borderRadius: 999,
    border: "1px solid",
    letterSpacing: "0.02em",
    flexShrink: 0,
  },
  iconButton: {
    width: 28,
    height: 28,
    borderRadius: 4,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 18,
    color: "var(--slate, #374151)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    lineHeight: 1,
  },
  confirmRow: {
    display: "flex",
    gap: 6,
    alignItems: "center",
  },
  deleteConfirmButton: {
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 600,
    background: "var(--red, #E11D48)",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
  },
  addButton: {
    padding: "11px 16px",
    fontSize: 14,
    fontWeight: 500,
    background: "var(--mist, #F4F7F5)",
    border: "1px dashed var(--line, #D8E0DC)",
    borderRadius: 8,
    cursor: "pointer",
    color: "var(--slate, #374151)",
    textAlign: "left",
    minHeight: 44,
  },
  addForm: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    padding: 16,
    background: "var(--mist, #F4F7F5)",
    borderRadius: 8,
    border: "1px solid var(--line, #D8E0DC)",
  },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  label: { fontSize: 13, fontWeight: 500, color: "var(--slate, #374151)" },
  hint: { fontSize: 12, color: "var(--slate, #374151)", opacity: 0.75 },
  input: {
    padding: "10px 12px",
    fontSize: 15,
    borderRadius: 8,
    border: "1px solid var(--line, #D8E0DC)",
    background: "var(--paper, #FFFFFF)",
    color: "var(--ink, #111827)",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  channelRow: {
    display: "flex",
    gap: 16,
  },
  channelOption: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 14,
    cursor: "pointer",
    color: "var(--ink, #111827)",
  },
  errorText: {
    fontSize: 13,
    color: "var(--red, #E11D48)",
    margin: 0,
    fontWeight: 500,
  },
  formActions: { display: "flex", gap: 10, alignItems: "center" },
  primaryButton: {
    padding: "11px 18px",
    fontSize: 14,
    fontWeight: 600,
    background: "var(--forest, #1F6F50)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    minHeight: 44,
  },
  ghostButton: {
    padding: "10px",
    fontSize: 13,
    background: "transparent",
    color: "var(--slate, #374151)",
    border: "none",
    cursor: "pointer",
    textDecoration: "underline",
  },
  emptyState: {
    padding: "12px 0",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  muted: {
    fontSize: 14,
    color: "var(--slate, #374151)",
    margin: 0,
  },
};