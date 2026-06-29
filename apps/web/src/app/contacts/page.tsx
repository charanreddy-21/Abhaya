"use client";
import TrustedContacts from "../../components/domain/trusted-contacts";

export default function ContactsPage() {
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>
      <TrustedContacts />
    </main>
  );
}