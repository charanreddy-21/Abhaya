'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User, Shield, Bell, MapPin, Mic, Camera, Eye, EyeOff,
  Trash2, ChevronRight, AlertTriangle, LockKeyhole, Moon,
  Smartphone, Mail,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/ui/page-header';

interface SettingsSection {
  id: string;
  eyebrow: string;
  title: string;
  icon: React.ReactNode;
}

const SECTIONS: SettingsSection[] = [
  { id: 'profile', eyebrow: 'Account', title: 'Profile', icon: <User size={18} /> },
  { id: 'privacy', eyebrow: 'Safety', title: 'Privacy & witness', icon: <Shield size={18} /> },
  { id: 'permissions', eyebrow: 'Browser', title: 'Permissions', icon: <Smartphone size={18} /> },
  { id: 'notifications', eyebrow: 'Alerts', title: 'Notifications', icon: <Bell size={18} /> },
  { id: 'account', eyebrow: 'Danger zone', title: 'Account actions', icon: <AlertTriangle size={18} /> },
];

export function SettingsView() {
  const [activeSection, setActiveSection] = useState('profile');

  return (
    <div className="view-container settings-view">
      <PageHeader
        eyebrow="Settings"
        title="Preferences"
        subtitle="Manage your profile, privacy, permissions, and account."
      />

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {SECTIONS.map(({ id, eyebrow, title, icon }) => (
            <button
              key={id}
              className={`settings-nav-item ${activeSection === id ? 'is-active' : ''}`}
              onClick={() => setActiveSection(id)}
              type="button"
            >
              <span className="settings-nav-icon">{icon}</span>
              <div>
                <p className="settings-nav-eyebrow">{eyebrow}</p>
                <p className="settings-nav-label">{title}</p>
              </div>
              <ChevronRight size={16} className="settings-nav-chevron" />
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {activeSection === 'profile' && <ProfileSection />}
          {activeSection === 'privacy' && <PrivacySection />}
          {activeSection === 'permissions' && <PermissionsSection />}
          {activeSection === 'notifications' && <NotificationsSection />}
          {activeSection === 'account' && <AccountSection />}
        </div>
      </div>
    </div>
  );
}

function ProfileSection() {
  return (
    <motion.div key="profile" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="settings-section">
      <Panel eyebrow="Account" icon={<User size={18} />} title="Profile">
        <div className="profile-avatar-row">
          <div className="profile-avatar">
            <User size={32} />
          </div>
          <div>
            <p className="profile-name">Anonymous User</p>
            <p className="profile-email">user@example.com</p>
            <Badge tone="info">User role</Badge>
          </div>
        </div>
        <div className="settings-field-list">
          <SettingsField icon={<User size={15} />} label="Display name" value="Anonymous User" hint="Visible only to you and admins if you reveal your identity during an incident." />
          <SettingsField icon={<Mail size={15} />} label="Email" value="user@example.com" hint="Used for authentication only. Not shared with witnesses." />
          <SettingsField icon={<LockKeyhole size={15} />} label="Role" value="User" />
        </div>
      </Panel>
    </motion.div>
  );
}

function PrivacySection() {
  const [witnessOptIn, setWitnessOptIn] = useState(false);
  const [locationTemp, setLocationTemp] = useState(true);
  const [anonymous, setAnonymous] = useState(true);

  return (
    <motion.div key="privacy" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="settings-section">
      <Panel eyebrow="Privacy" icon={<Shield size={18} />} title="Witness & privacy">
        <SettingsToggle
          icon={<Eye size={16} />}
          title="Receive witness alerts"
          description="Be alerted when someone nearby triggers an SOS. Your identity stays hidden unless you choose to reveal it."
          checked={witnessOptIn}
          onToggle={() => setWitnessOptIn(v => !v)}
          badge={witnessOptIn ? <Badge tone="ok">Active</Badge> : <Badge tone="neutral">Off</Badge>}
        />
        <SettingsToggle
          icon={<MapPin size={16} />}
          title="Temporary location storage only"
          description="Location data is not retained after an incident resolves. This setting cannot be turned off — it is always on."
          checked={locationTemp}
          onToggle={() => {}}
          disabled
        />
        <SettingsToggle
          icon={<EyeOff size={16} />}
          title="Anonymous by default"
          description="Your identity is always hidden in witness mode unless you explicitly reveal it during an incident."
          checked={anonymous}
          onToggle={() => setAnonymous(v => !v)}
        />
      </Panel>

      <div className="settings-notice">
        <Shield size={14} />
        <p>Abhaya is designed as an anti-surveillance product. No background location tracking. No permanent location history.</p>
      </div>
    </motion.div>
  );
}

function PermissionsSection() {
  const permissions = [
    { icon: <MapPin size={16} />, name: 'Location', status: 'granted' as const, hint: 'Required for nearby alerts. Only used during active SOS.' },
    { icon: <Mic size={16} />, name: 'Microphone', status: 'prompt' as const, hint: 'Optional. Used to capture audio evidence during SOS.' },
    { icon: <Camera size={16} />, name: 'Camera', status: 'denied' as const, hint: 'Optional. Used to capture video evidence during SOS.' },
    { icon: <Bell size={16} />, name: 'Push notifications', status: 'prompt' as const, hint: 'Recommended for witness alerts when the app is in the background.' },
  ];

  return (
    <motion.div key="perms" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="settings-section">
      <Panel eyebrow="Browser" icon={<Smartphone size={18} />} title="Permissions">
        <div className="permission-list">
          {permissions.map((p) => (
            <div key={p.name} className="permission-card">
              <div className={`permission-icon perm-${p.status}`}>{p.icon}</div>
              <div className="permission-info">
                <div className="permission-title-row">
                  <p className="permission-name">{p.name}</p>
                  <PermissionBadge status={p.status} />
                </div>
                <p className="permission-hint">{p.hint}</p>
              </div>
              {p.status !== 'granted' && (
                <Button variant="ghost" size="sm">Enable</Button>
              )}
            </div>
          ))}
        </div>
      </Panel>
      <div className="settings-notice">
        <AlertTriangle size={14} />
        <p>SOS can start even if permissions are denied. Evidence capture and nearby alerts may be limited.</p>
      </div>
    </motion.div>
  );
}

function NotificationsSection() {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [inApp, setInApp] = useState(true);

  return (
    <motion.div key="notifs" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="settings-section">
      <Panel eyebrow="Alerts" icon={<Bell size={18} />} title="Notifications">
        <SettingsToggle
          icon={<Bell size={16} />}
          title="Push notifications"
          description="Receive witness alerts when Abhaya is in the background. Requires browser permission."
          checked={pushEnabled}
          onToggle={() => setPushEnabled(v => !v)}
          badge={!pushEnabled ? <Badge tone="warn">Off</Badge> : undefined}
        />
        <SettingsToggle
          icon={<Smartphone size={16} />}
          title="In-app alerts"
          description="Show incident updates while Abhaya is open. Recommended as a fallback when push is off."
          checked={inApp}
          onToggle={() => setInApp(v => !v)}
        />
      </Panel>
      {!pushEnabled && (
        <div className="settings-notice warn">
          <Bell size={14} />
          <p>Push notifications are off. You can still use Abhaya while the app is open.</p>
        </div>
      )}
    </motion.div>
  );
}

function AccountSection() {
  return (
    <motion.div key="account" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="settings-section">
      <Panel eyebrow="Danger zone" icon={<AlertTriangle size={18} />} title="Account actions">
        <div className="danger-zone">
          <DangerAction
            icon={<Trash2 size={18} />}
            title="Delete all evidence"
            description="Permanently delete all your evidence items. A minimal deletion audit event will remain."
            buttonLabel="Delete all evidence"
            tone="warn"
          />
          <DangerAction
            icon={<AlertTriangle size={18} />}
            title="Delete account"
            description="Permanently delete your account and all associated data. This cannot be undone."
            buttonLabel="Delete my account"
            tone="danger"
          />
        </div>
      </Panel>
    </motion.div>
  );
}

function SettingsField({ icon, label, value, hint }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="settings-field">
      <div className="settings-field-icon">{icon}</div>
      <div>
        <p className="settings-field-label">{label}</p>
        <p className="settings-field-value">{value}</p>
        {hint && <p className="settings-field-hint">{hint}</p>}
      </div>
    </div>
  );
}

function SettingsToggle({ icon, title, description, checked, onToggle, disabled, badge }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <div className={`settings-toggle ${disabled ? 'is-disabled' : ''}`}>
      <div className="settings-toggle-icon">{icon}</div>
      <div className="settings-toggle-info">
        <div className="settings-toggle-title-row">
          <p className="settings-toggle-title">{title}</p>
          {badge}
        </div>
        <p className="settings-toggle-desc">{description}</p>
      </div>
      <Switch
        checked={checked}
        label={`Toggle ${title}`}
        onClick={onToggle}
        disabled={disabled}
      />
    </div>
  );
}

function PermissionBadge({ status }: { status: 'granted' | 'denied' | 'prompt' }) {
  if (status === 'granted') return <Badge tone="ok">Granted</Badge>;
  if (status === 'denied') return <Badge tone="danger">Denied</Badge>;
  return <Badge tone="warn">Not set</Badge>;
}

function DangerAction({ icon, title, description, buttonLabel, tone }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonLabel: string;
  tone: 'warn' | 'danger';
}) {
  return (
    <div className={`danger-action-row tone-border-${tone}`}>
      <div className={`danger-action-icon tone-${tone}`}>{icon}</div>
      <div>
        <p className="danger-action-title">{title}</p>
        <p className="danger-action-desc">{description}</p>
      </div>
      <Button variant={tone === 'danger' ? 'danger' : 'secondary'} size="sm">{buttonLabel}</Button>
    </div>
  );
}
