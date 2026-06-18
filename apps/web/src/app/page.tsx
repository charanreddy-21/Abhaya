'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  EyeOff,
  HeartPulse,
  Loader2,
  LockKeyhole,
  MapPin,
  Mic,
  Radio,
  RefreshCcw,
  Shield,
  Siren,
  UserRoundCheck,
  WifiOff,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type HealthState = 'checking' | 'online' | 'offline';
type LocationState = 'idle' | 'checking' | 'ready' | 'denied' | 'imprecise' | 'unsupported';
type SosState = 'idle' | 'arming' | 'active' | 'resolved';

interface SystemStatus {
  status: number;
  service: string;
  spatial_engine: boolean;
}

interface ReadinessItem {
  title: string;
  message: string;
  tone: 'ok' | 'warn' | 'danger' | 'info';
  icon: ReactNode;
  action?: ReactNode;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
const LOCATION_ACCURACY_LIMIT_METERS = 150;

export default function AbhayaDashboard() {
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
          <button className="ghost-button" type="button" onClick={() => void checkBackend()} aria-label="Recheck backend">
            <RefreshCcw size={16} />
          </button>
        ),
      },
      {
        title: 'Location',
        message: locationCopy.message,
        tone: locationCopy.tone,
        icon: locationCopy.icon,
        action:
          locationState === 'ready' ? undefined : (
            <button className="ghost-button" type="button" onClick={requestLocation}>
              Enable
            </button>
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

  return (
    <main className="app-shell">
      <div className="dashboard">
        <section className="hero" aria-labelledby="page-title">
          <div className="brand-row">
            <div className="brand">
              <div className="brand-mark" aria-hidden="true">
                <Shield size={24} />
              </div>
              <div>
                <p className="eyebrow">Abhaya</p>
                <h2 className="brand-title">Safety with reason</h2>
              </div>
            </div>
            <span className={healthState === 'online' ? 'badge' : 'badge warn'}>
              {healthState === 'online' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
              {healthState === 'online' ? 'Connected' : healthState === 'checking' ? 'Checking' : 'Degraded'}
            </span>
          </div>

          <div className="hero-copy">
            <p className="kicker">PWA safety surface</p>
            <h1 id="page-title">Start an SOS without losing clarity.</h1>
            <p>{statusMessage}</p>
          </div>

          <div className="sos-stage">
            <div className="sos-card">
              <button
                className={sosState === 'active' ? 'sos-button is-active' : 'sos-button'}
                type="button"
                onClick={handleSosAction}
                aria-live="polite"
              >
                <span>{sosButtonCopy.title}</span>
                <small>{sosButtonCopy.subtitle}</small>
              </button>

              <div className="toolbar">
                <button className="secondary-button" type="button" onClick={requestLocation}>
                  <MapPin size={18} />
                  Check location
                </button>
                <button className="secondary-button" type="button" onClick={() => void checkBackend()}>
                  <Radio size={18} />
                  Check system
                </button>
              </div>
            </div>
          </div>
        </section>

        <aside className="panel-stack" aria-label="Readiness and incident details">
          <section className="panel">
            <div className="incident-header">
              <div>
                <p className="eyebrow">Readiness</p>
                <h2 className="section-title">Before SOS</h2>
              </div>
              <Clock3 size={20} aria-hidden="true" />
            </div>

            <div className="readiness-grid">
              {readinessItems.map((item) => (
                <article className="status-card" key={item.title}>
                  <div className="status-row">
                    <div className={`status-icon tone-${item.tone}`}>{item.icon}</div>
                    {item.action}
                  </div>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.message}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="toggle-row">
              <div>
                <h3 className="incident-title">Receive witness alerts</h3>
                <p className="incident-copy">Your identity stays hidden unless you choose to reveal it.</p>
              </div>
              <button
                className="toggle"
                type="button"
                role="switch"
                aria-checked={witnessOptIn}
                aria-label="Toggle witness alert opt in"
                onClick={() => setWitnessOptIn((value) => !value)}
              />
            </div>
          </section>

          <section className="incident-map" aria-label="Approximate incident map preview">
            <div className="map-label">
              Abhaya will show approximate zones to witnesses. It will not expose live responder locations to the SOS sender.
            </div>
          </section>

          <section className="panel">
            <div className="incident-header">
              <div>
                <p className="eyebrow">Active incident plan</p>
                <h2 className="section-title">What happens next</h2>
              </div>
              <HeartPulse size={20} aria-hidden="true" />
            </div>

            <div className="metric-row">
              <Siren size={24} className="tone-danger" aria-hidden="true" />
              <div>
                <p className="metric-label">SOS state</p>
                <p className="metric-value">{formatSosState(sosState)}</p>
              </div>
            </div>

            <div className="metric-row">
              <LockKeyhole size={24} className="tone-info" aria-hidden="true" />
              <div>
                <p className="metric-label">Evidence mode</p>
                <p className="metric-value">Encrypted</p>
              </div>
            </div>

            <div className="metric-row">
              <Clock3 size={24} className="tone-warn" aria-hidden="true" />
              <div>
                <p className="metric-label">Elapsed time</p>
                <p className="metric-value">{activeMinutes > 0 ? `${activeMinutes} min` : 'Not active'}</p>
              </div>
            </div>

            <div className="step-list">
              {[
                ['1', 'Create SOS', 'Start incident state and keep a local retry path if the network fails.'],
                ['2', 'Alert witnesses', 'Notify nearby opted-in users without revealing unnecessary identity data.'],
                ['3', 'Preserve evidence', 'Record when allowed, hash locally, encrypt, and upload when possible.'],
              ].map(([step, title, copy]) => (
                <div className="step-row" key={title}>
                  <div className="step-number">{step}</div>
                  <div>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
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
