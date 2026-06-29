"use client";

import { ShieldCheck, Users } from "lucide-react";
import TrustedContacts from "../../components/domain/trusted-contacts";
import { AuthGuard } from "@/components/layout/auth-guard";
import { PageHeader } from "@/components/ui/page-header";

export default function ContactsPage() {
  return (
    <AuthGuard>
      <div className="view-container feature-page feature-page-narrow">
        <PageHeader
          eyebrow="Echo"
          title="Trusted contacts"
          subtitle="Choose the people Abhaya can help you notify during SOS or a missed Safe Trip check-in."
        />
        <div className="feature-assurance-strip" role="note">
          <span className="feature-assurance-icon"><ShieldCheck size={16} /></span>
          <p>Phone numbers are masked in the app. Keep contacts current and tell them what Abhaya alerts mean.</p>
        </div>
        <TrustedContacts />
        <div className="feature-helper-card">
          <Users size={18} />
          <div>
            <p className="feature-helper-title">Who should be here?</p>
            <p className="feature-helper-copy">Pick people who usually answer quickly and know your daily routes. Abhaya cannot confirm they will respond.</p>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
