"use client";

import { Clock3, MapPinned, ShieldCheck } from "lucide-react";
import SafeTripPanel from "../../components/domain/safe-trip";
import { AuthGuard } from "@/components/layout/auth-guard";
import { PageHeader } from "@/components/ui/page-header";

export default function TripPage() {
  return (
    <AuthGuard>
      <div className="view-container feature-page feature-page-narrow">
        <PageHeader
          eyebrow="Buffer and ping"
          title="Safe Trip"
          subtitle="Set an expected arrival time. If you miss check-in, Abhaya can prompt you and notify trusted contacts."
        />
        <div className="trip-primer-grid">
          <div className="trip-primer-item">
            <Clock3 size={16} />
            <span>Timer first</span>
          </div>
          <div className="trip-primer-item">
            <ShieldCheck size={16} />
            <span>2-minute check-in window</span>
          </div>
          <div className="trip-primer-item">
            <MapPinned size={16} />
            <span>Last known location when available</span>
          </div>
        </div>
        <SafeTripPanel />
        <div className="feature-assurance-strip" role="note">
          <span className="feature-assurance-icon"><ShieldCheck size={16} /></span>
          <p>Safe Trip supports check-ins and trusted-contact alerts. It does not guarantee that someone will arrive or that emergency services are dispatched.</p>
        </div>
      </div>
    </AuthGuard>
  );
}
