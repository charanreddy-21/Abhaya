'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  ChevronRight,
  FileVideo,
  MapPin,
  Shield,
  Siren,
  Users,
  WifiOff,
} from 'lucide-react';
import { AbhayaGlyph } from '@/components/brand/abhaya-glyph';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '@/lib/auth-context';
import { sosApi, healthApi } from '@/lib/api';
import { useQuery, useOnlineStatus } from '@/lib/hooks';
import type { Incident } from '@/lib/types';

interface QuickLink {
  href: string;
  icon: React.ReactNode;
  label: string;
  desc: string;
}

const QUICK_LINKS: QuickLink[] = [
  { href: '/sos/history',   icon: <Siren size={18} />,    label: 'SOS history',    desc: 'Past incidents' },
  { href: '/witness/alert', icon: <Users size={18} />,    label: 'Witness alerts', desc: 'Nearby requests' },
  { href: '/evidence',      icon: <FileVideo size={18} />, label: 'Evidence',       desc: 'Captured media' },
  { href: '/safe-places',   icon: <MapPin size={18} />,   label: 'Safe places',    desc: 'Nearby locations' },
];

export function SafetyHome() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) return <LandingView />;
  return <DashboardView user={user} />;
}

// ── Authenticated dashboard ─────────────────────────────────────────────────

function DashboardView({ user }: { user: { display_name: string } | null }) {
  const isOnline = useOnlineStatus();

  const { data: activeIncidents } = useQuery(
    () => sosApi.getActive(),
    [],
    { intervalMs: 15_000 },
  );

  const { data: health } = useQuery(
    () => healthApi.check(),
    [],
    { intervalMs: 30_000 },
  );

  const activeIncident: Incident | undefined = activeIncidents?.[0];

  return (
    <div className="view-container dashboard-view">
      <PageHeader
        eyebrow="Home"
        title={user ? `Welcome, ${user.display_name.split(' ')[0]}` : 'Abhaya'}
        subtitle="Safety with reason."
      />

      {/* Active incident banner */}
      {activeIncident && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <Link href="/sos/active" className="dashboard-active-banner">
            <span className="live-dot" aria-hidden />
            <div className="dashboard-active-banner-body">
              <p className="dashboard-active-banner-title">SOS active</p>
              <p>Incident {activeIncident.id.slice(0, 8).toUpperCase()} is ongoing — tap to manage.</p>
            </div>
            <ChevronRight size={18} style={{ color: 'var(--red)', flexShrink: 0 }} />
          </Link>
        </motion.div>
      )}

      {/* SOS hero */}
      <div className="dashboard-sos-hero">
        <h2>Emergency SOS</h2>
        <p>
          Start an SOS to alert nearby opted-in users. No police dispatch.
          Call 112 for life-threatening emergencies.
        </p>
        <Link href="/sos/active" className="dashboard-sos-btn" aria-label="Start SOS">
          <Siren size={22} />
          {activeIncident ? 'Manage active SOS' : 'Start SOS'}
        </Link>
      </div>

      {/* System status */}
      <Panel eyebrow="System" icon={<Shield size={18} />} title="Status">
        <div className="dashboard-status-row">
          {!isOnline ? (
            <Badge tone="warn" icon={<WifiOff size={12} />}>Offline</Badge>
          ) : health ? (
            <Badge tone="ok" icon={<Shield size={12} />}>Server connected</Badge>
          ) : (
            <Badge tone="info">Checking…</Badge>
          )}
          {activeIncident ? (
            <Badge tone="danger" icon={<Siren size={12} />}>SOS active</Badge>
          ) : (
            <Badge tone="ok">No active SOS</Badge>
          )}
          {!isOnline && (
            <div className="sos-safety-notice" style={{ marginTop: 8 }}>
              <AlertTriangle size={14} />
              <p>
                You are offline. SOS can still be queued and will be sent when the network returns.
                Keep this app open.
              </p>
            </div>
          )}
        </div>
      </Panel>

      {/* Quick links */}
      <div>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>Quick access</p>
        <div className="dashboard-quick-links">
          {QUICK_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="dashboard-quick-link">
              <div className="dashboard-quick-link-icon">{link.icon}</div>
              <span className="dashboard-quick-link-label">{link.label}</span>
              <span className="dashboard-quick-link-desc">{link.desc}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Safety notice */}
      <div className="sos-safety-notice">
        <Shield size={14} />
        <p>
          Abhaya alerts nearby opted-in users only. It does not dispatch police or emergency
          services. In a life-threatening emergency, call 112.
        </p>
      </div>
    </div>
  );
}

// ── Unauthenticated landing ─────────────────────────────────────────────────

function LandingView() {
  const router = useRouter();

  const features = [
    { text: 'SOS alerts sent to nearby opted-in users — no police dispatch' },
    { text: 'Evidence encrypted on your device before upload' },
    { text: 'Witness anonymity by default — identity revealed only by choice' },
    { text: 'Verified safe places nearby: hospitals, police, shelters' },
  ];

  return (
    <div className="landing-view">
      <div className="landing-brand">
        <div className="landing-glyph">
          <AbhayaGlyph />
        </div>
        <h1 className="landing-title">Abhaya</h1>
        <p className="landing-subtitle">
          A public safety companion for India. Safety with reason — calm, honest, and clear about what it can and cannot do.
        </p>
      </div>

      <div className="landing-features">
        {features.map((f) => (
          <div key={f.text} className="landing-feature-row">
            <Shield size={14} className="landing-feature-icon" />
            <span>{f.text}</span>
          </div>
        ))}
      </div>

      <div className="landing-cta">
        <Button
          variant="secondary"
          size="lg"
          icon={<ArrowRight size={16} />}
          onClick={() => router.push('/auth/login')}
        >
          Sign in to continue
        </Button>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
          Demo accounts available on the sign-in page.
        </p>
      </div>

      <div className="sos-safety-notice">
        <Bell size={14} />
        <p>
          Abhaya is a hackathon prototype. It does not dispatch emergency services.
          Call 112 in life-threatening emergencies.
        </p>
      </div>
    </div>
  );
}
