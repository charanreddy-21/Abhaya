'use client';

import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  EyeOff,
  HeartPulse,
  Loader2,
  LockKeyhole,
  MapPin,
  Mic,
  Navigation,
  Radio,
  RefreshCcw,
  Route,
  Shield,
  Siren,
  Sparkles,
  UserRoundCheck,
  WifiOff,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AbhayaGlyph } from '@/components/brand/abhaya-glyph';
import { Badge, Button, MetricRow, Panel, StatusCard, Switch } from '@/components/ui';

type HealthState = 'checking' | 'online' | 'offline';
type LocationState = 'idle' | 'checking' | 'ready' | 'denied' | 'imprecise' | 'unsupported';
type SosState = 'idle' | 'arming' | 'active' | 'resolved';

interface SystemStatus {
  status: number;
  service: string;
  spatial_engine: boolean;
}

interface ReadinessItem {
  action?: ReactNode;
  icon: ReactNode;
  message: string;
  title: string;
  tone: 'ok' | 'warn' | 'danger' | 'info';
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
const LOCATION_ACCURACY_LIMIT_METERS = 150;

export function SafetyHome() {
  const [backendState, setBackendState] = useState<SystemStatus | null>(null);
  const [healthState, setHealthState] = useState<HealthState>('checking');
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [witnessOptIn, setWitnessOptIn] = useState(false);
  const [sosState, setSosState] = useState<SosState>('idle');
  const [incidentStartedAt, setIncidentStartedAt] = useState<Date | null>(null);
  const [statusMessage, setStatusMessage] = useState('Abhaya is checking readiness before an SOS.');

  const checkBackend = useCallback(async () => {
    setHealthState('checking');

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4500);

    try {
      const response = await fetch(`${API_BASE_URL}/api/health`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Health check failed with ${response.status}`);
      }

      const data = (await response.json()) as SystemStatus;
      setBackendState(data);
      setHealthState('online');
      setStatusMessage('Abhaya is connected and ready to send nearby alerts.');
    } catch {
      setBackendState(null);
      setHealthState('offline');
      setStatusMessage('Abhaya cannot reach the server right now. Keep emergency contacts available and try again.');
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationState('unsupported');
      setStatusMessage('This browser does not support location. Nearby alerts may not work here.');
      return;
    }

    setLocationState('checking');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const accuracy = Math.round(position.coords.accuracy);
        setLocationAccuracy(accuracy);

        if (accuracy > LOCATION_ACCURACY_LIMIT_METERS) {
          setLocationState('imprecise');
          setStatusMessage('Your location looks imprecise. Move near a window or open area if you can.');
          return;
        }

        setLocationState('ready');
        setStatusMessage('Location is ready. Nearby opted-in users can be alerted during SOS.');
      },
      () => {
        setLocationState('denied');
        setStatusMessage('Location is off. Turn it on so nearby alerts can be sent.');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 15000,
        timeout: 10000,
      },
    );
  }, []);

  useEffect(() => {
    void checkBackend();
  }, [checkBackend]);

  const readinessItems = useMemo<ReadinessItem[]>(() => {
    const locationCopy = getLocationCopy(locationState, locationAccuracy);

    return [
      {
        title: 'Core API',
        message:
          healthState === 'online'
            ? backendState?.service ?? 'Abhaya backend is online.'
            : healthState === 'checking'
              ? 'Checking backend connection.'
              : 'Server is unreachable. SOS will show retry guidance.',
        tone: healthState === 'online' ? 'ok' : healthState === 'checking' ? 'info' : 'danger',
        icon: healthState === 'online' ? <CheckCircle2 size={20} /> : healthState === 'checking' ? <Loader2 size={20} /> : <WifiOff size={20} />,
        action: (
          <Button aria-label="Recheck backend" icon={<RefreshCcw size={16} />} onClick={() => void checkBackend()} size="sm" variant="ghost">
            Retry
          </Button>
        ),
      },
      {
        title: 'Location',
        message: locationCopy.message,
        tone: locationCopy.tone,
        icon: locationCopy.icon,
        action:
          locationState === 'ready' ? undefined : (
            <Button onClick={requestLocation} size="sm" variant="ghost">
              Enable
            </Button>
          ),
      },
      {
        title: 'Witness network',
        message: witnessOptIn ? 'You can receive anonymous nearby alerts.' : 'Opt in when you are ready to help nearby users.',
        tone: witnessOptIn ? 'ok' : 'warn',
        icon: witnessOptIn ? <UserRoundCheck size={20} /> : <EyeOff size={20} />,
      },
      {
        title: 'Evidence support',
        message: 'Recording depends on browser permission. SOS continues even if recording fails.',
        tone: 'info',
        icon: <Mic size={20} />,
      },
    ];
  }, [backendState?.service, checkBackend, healthState, locationAccuracy, locationState, requestLocation, witnessOptIn]);

  function handleSosAction() {
    if (sosState === 'idle') {
      setSosState('arming');
      setStatusMessage('Press again to start SOS. Abhaya will alert nearby opted-in users.');
      return;
    }

    if (sosState === 'arming') {
      setSosState('active');
      setIncidentStartedAt(new Date());

      if (healthState === 'offline') {
        setStatusMessage('SOS is pending locally because the server is offline. Abhaya will keep retrying.');
        return;
      }

      if (locationState !== 'ready' && locationState !== 'imprecise') {
        setStatusMessage('SOS is active, but location needs attention before nearby alerts can be accurate.');
        return;
      }

      setStatusMessage('SOS active. Nearby opted-in users are being alerted.');
      return;
    }

    if (sosState === 'active') {
      setSosState('resolved');
      setStatusMessage('Incident marked resolved on this device. Backend persistence is planned next.');
      return;
    }

    setSosState('idle');
    setIncidentStartedAt(null);
    setStatusMessage('Abhaya is ready.');
  }

  const sosButtonCopy = getSosButtonCopy(sosState);
  const activeMinutes = incidentStartedAt ? Math.max(1, Math.ceil((Date.now() - incidentStartedAt.getTime()) / 60000)) : 0;
  const healthBadgeTone = healthState === 'online' ? 'ok' : healthState === 'checking' ? 'info' : 'warn';

  return (
    <section className="home-shell" aria-labelledby="page-title">
        <header className="topbar">
          <a className="brand-link" href="#top" aria-label="Abhaya home">
            <span className="brand-mark" aria-hidden="true">
              <AbhayaGlyph />
            </span>
            <span>
              <span className="eyebrow">Abhaya</span>
              <span className="brand-title">Safety with reason</span>
            </span>
          </a>
          <nav className="topbar-nav" aria-label="Prototype sections">
            <a href="#readiness">Readiness</a>
            <a href="#flow">Flow</a>
            <a href="#library">UI kit</a>
          </nav>
          <Badge icon={healthState === 'online' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} tone={healthBadgeTone}>
            {healthState === 'online' ? 'Connected' : healthState === 'checking' ? 'Checking' : 'Degraded'}
          </Badge>
        </header>

        <div className="home-grid">
          <section className="hero-panel">
            <div className="hero-copy">
              <Badge icon={<Sparkles size={15} />} tone="info">Hackathon PWA prototype</Badge>
              <h1 id="page-title">An SOS surface that stays calm when the moment is not.</h1>
              <p>{statusMessage}</p>
            </div>

            <div className="hero-actions">
              <Button icon={<MapPin size={18} />} onClick={requestLocation} size="lg" variant="secondary">
                Check location
              </Button>
              <Button icon={<Radio size={18} />} onClick={() => void checkBackend()} size="lg" variant="secondary">
                Check system
              </Button>
            </div>

            <SOSPanel buttonCopy={sosButtonCopy} onAction={handleSosAction} sosState={sosState} />
          </section>

          <aside className="home-side" aria-label="Readiness and incident details">
            <Panel eyebrow="Readiness" icon={<Clock3 size={20} />} id="readiness" title="Before SOS">
              <div className="readiness-grid">
                {readinessItems.map((item) => (
                  <StatusCard action={item.action} icon={item.icon} key={item.title} message={item.message} title={item.title} tone={item.tone} />
                ))}
              </div>

              <div className="toggle-row">
                <div>
                  <h3 className="incident-title">Receive witness alerts</h3>
                  <p className="incident-copy">Your identity stays hidden unless you choose to reveal it.</p>
                </div>
                <Switch checked={witnessOptIn} label="Toggle witness alert opt in" onClick={() => setWitnessOptIn((value) => !value)} />
              </div>
            </Panel>

            <ApproxIncidentMap />

            <Panel eyebrow="Active incident plan" icon={<HeartPulse size={20} />} title="What happens next">
              <MetricRow icon={<Siren size={24} />} label="SOS state" tone="danger" value={formatSosState(sosState)} />
              <MetricRow icon={<LockKeyhole size={24} />} label="Evidence mode" tone="info" value="Encrypted" />
              <MetricRow icon={<Clock3 size={24} />} label="Elapsed time" tone="warn" value={activeMinutes > 0 ? `${activeMinutes} min` : 'Not active'} />
            </Panel>
          </aside>
        </div>

      <CapabilitySection />
      <PrototypeFlow />
      <UILibraryPreview />
    </section>
  );
}

interface SOSPanelProps {
  buttonCopy: {
    subtitle: string;
    title: string;
  };
  onAction: () => void;
  sosState: SosState;
}

function SOSPanel({ buttonCopy, onAction, sosState }: SOSPanelProps) {
  return (
    <section className="sos-panel" aria-label="SOS controls">
      <button
        aria-live="polite"
        className={sosState === 'active' ? 'sos-button is-active' : 'sos-button'}
        onClick={onAction}
        type="button"
      >
        <span>{buttonCopy.title}</span>
        <small>{buttonCopy.subtitle}</small>
      </button>
      <div className="sos-panel-meta">
        <span>
          <Shield size={16} />
          No police dispatch claims
        </span>
        <span>
          <LockKeyhole size={16} />
          Evidence integrity support
        </span>
      </div>
    </section>
  );
}

function ApproxIncidentMap() {
  return (
    <section className="incident-map" aria-label="Approximate incident map preview">
      <div className="map-route route-one" />
      <div className="map-route route-two" />
      <div className="map-safe-place safe-one">
        <Shield size={14} />
      </div>
      <div className="map-safe-place safe-two">
        <Navigation size={14} />
      </div>
      <div className="map-label">
        Abhaya shows approximate zones to witnesses and never exposes live responder locations to the SOS sender.
      </div>
    </section>
  );
}

function CapabilitySection() {
  const capabilities = [
    {
      icon: <Radio size={22} />,
      title: 'Nearby opted-in alerts',
      copy: 'A privacy-bounded witness network that alerts people nearby without turning them into trackers.',
    },
    {
      icon: <LockKeyhole size={22} />,
      title: 'Evidence integrity',
      copy: 'Capture where the browser allows it, then hash and encrypt before upload for future FIR support.',
    },
    {
      icon: <Route size={22} />,
      title: 'Safe-place context',
      copy: 'Show nearby public places with explicit verification states instead of pretending routes are guaranteed safe.',
    },
    {
      icon: <EyeOff size={22} />,
      title: 'Anonymity by default',
      copy: 'Witnesses stay anonymous until they choose to reveal themselves. Admin access is designed for auditability.',
    },
  ];

  return (
    <section className="content-section" aria-labelledby="capability-title">
      <div className="section-heading">
        <p className="eyebrow">Prototype capabilities</p>
        <h2 id="capability-title">Built around limits, not hype.</h2>
      </div>
      <div className="capability-grid">
        {capabilities.map((item) => (
          <article className="capability-item" key={item.title}>
            <div className="status-icon tone-info">{item.icon}</div>
            <h3>{item.title}</h3>
            <p>{item.copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function PrototypeFlow() {
  const steps = [
    ['01', 'Create SOS', 'Start incident state and keep a local retry path if the network fails.'],
    ['02', 'Alert witnesses', 'Notify nearby opted-in users without revealing unnecessary identity data.'],
    ['03', 'Preserve evidence', 'Record when allowed, hash locally, encrypt, and upload when possible.'],
    ['04', 'Review safely', 'Admins get a command center view with minimal exposure and audit events.'],
  ];

  return (
    <section className="content-section split-section" id="flow" aria-labelledby="flow-title">
      <div className="section-heading">
        <p className="eyebrow">System flow</p>
        <h2 id="flow-title">A full incident loop, shaped for the hackathon build.</h2>
      </div>
      <div className="step-list">
        {steps.map(([step, title, copy]) => (
          <div className="step-row" key={title}>
            <div className="step-number">{step}</div>
            <div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </div>
            <ChevronRight size={18} aria-hidden="true" />
          </div>
        ))}
      </div>
    </section>
  );
}

function UILibraryPreview() {
  return (
    <section className="content-section library-section" id="library" aria-labelledby="library-title">
      <div className="section-heading">
        <p className="eyebrow">UI library</p>
        <h2 id="library-title">Reusable pieces for the next screens.</h2>
      </div>
      <div className="library-grid">
        <Panel eyebrow="Buttons" title="Actions">
          <div className="library-row">
            <Button variant="danger">Start SOS</Button>
            <Button variant="secondary">Check system</Button>
            <Button variant="ghost">Dismiss</Button>
          </div>
        </Panel>
        <Panel eyebrow="Badges" title="States">
          <div className="library-row">
            <Badge tone="ok">Connected</Badge>
            <Badge tone="warn">Retrying</Badge>
            <Badge tone="danger">Permission off</Badge>
            <Badge tone="info">Anchoring</Badge>
          </div>
        </Panel>
        <Panel eyebrow="Inputs" title="Consent">
          <div className="toggle-row">
            <div>
              <h3 className="incident-title">Anonymous witness mode</h3>
              <p className="incident-copy">Reusable switch component with accessible state.</p>
            </div>
            <Switch checked label="Preview witness mode switch" />
          </div>
        </Panel>
      </div>
    </section>
  );
}

function getLocationCopy(state: LocationState, accuracy: number | null): Pick<ReadinessItem, 'message' | 'tone' | 'icon'> {
  if (state === 'ready') {
    return {
      message: accuracy ? `Ready with about ${accuracy}m accuracy.` : 'Ready for nearby alerts.',
      tone: 'ok',
      icon: <CheckCircle2 size={20} />,
    };
  }

  if (state === 'checking') {
    return {
      message: 'Checking current location.',
      tone: 'info',
      icon: <Loader2 size={20} />,
    };
  }

  if (state === 'imprecise') {
    return {
      message: accuracy ? `Location is imprecise at about ${accuracy}m.` : 'Location is imprecise.',
      tone: 'warn',
      icon: <AlertTriangle size={20} />,
    };
  }

  if (state === 'denied') {
    return {
      message: 'Location permission is off. SOS can start, but alerts may be limited.',
      tone: 'danger',
      icon: <MapPin size={20} />,
    };
  }

  if (state === 'unsupported') {
    return {
      message: 'This browser does not support location.',
      tone: 'danger',
      icon: <WifiOff size={20} />,
    };
  }

  return {
    message: 'Enable location before an emergency if you can.',
    tone: 'warn',
    icon: <MapPin size={20} />,
  };
}

function getSosButtonCopy(state: SosState) {
  if (state === 'arming') {
    return {
      title: 'Confirm SOS',
      subtitle: 'Press again to start nearby alerts',
    };
  }

  if (state === 'active') {
    return {
      title: 'SOS Active',
      subtitle: 'Press to mark resolved on this device',
    };
  }

  if (state === 'resolved') {
    return {
      title: 'Reset',
      subtitle: 'Prepare Abhaya for another incident',
    };
  }

  return {
    title: 'Start SOS',
    subtitle: 'Alerts, location, and evidence support',
  };
}

function formatSosState(state: SosState) {
  if (state === 'arming') {
    return 'Confirming';
  }

  if (state === 'active') {
    return 'Active';
  }

  if (state === 'resolved') {
    return 'Resolved';
  }

  return 'Ready';
}
