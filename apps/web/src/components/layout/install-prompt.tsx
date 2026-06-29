'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'abhaya:install-dismissed';

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone() || localStorage.getItem(DISMISS_KEY) === 'true') return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const onInstalled = () => {
      setVisible(false);
      setInstallEvent(null);
      localStorage.setItem(DISMISS_KEY, 'true');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') {
      localStorage.setItem(DISMISS_KEY, 'true');
      setVisible(false);
    }
    setInstallEvent(null);
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, 'true');
    setVisible(false);
  }

  if (!visible || !installEvent) return null;

  return (
    <aside className="install-prompt" aria-label="Install Abhaya">
      <div className="install-prompt-icon" aria-hidden>
        <Download size={18} />
      </div>
      <div className="install-prompt-copy">
        <p className="install-prompt-title">Install Abhaya</p>
        <p className="install-prompt-text">Open faster, keep key screens cached, and use it like an app.</p>
      </div>
      <button className="install-prompt-action" type="button" onClick={install}>
        Install
      </button>
      <button className="install-prompt-dismiss" type="button" onClick={dismiss} aria-label="Dismiss install prompt">
        <X size={16} />
      </button>
    </aside>
  );
}
