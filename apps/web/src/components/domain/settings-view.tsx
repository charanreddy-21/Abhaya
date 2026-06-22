'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Bell, Camera, ChevronRight, Eye,
  EyeOff, LockKeyhole, Loader2, Mail, MapPin, Mic,
  Shield, Smartphone, Trash2, User,
} from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import { useMutation } from '@/lib/hooks';
import { AbhayaApiError } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/ui/page-header';
import type { UpdateProfilePayload } from '@/lib/types';

type SectionId = 'profile' | 'privacy' | 'permissions' | 'notifications' | 'account';

const SECTIONS: { id: SectionId; eyebrow: string; title: string; icon: React.ReactNode }[] = [
  { id: 'profile',       eyebrow: 'Account',     title: 'Profile',          icon: <User size={18} /> },
  { id: 'privacy',       eyebrow: 'Safety',       title: 'Privacy & witness', icon: <Shield size={18} /> },
  { id: 'permissions',   eyebrow: 'Browser',      title: 'Permissions',      icon: <Smartphone size={18} /> },
  { id: 'notifications', eyebrow: 'Alerts',       title: 'Notifications',    icon: <Bell size={18} /> },
  { id: 'account',       eyebrow: 'Danger zone',  title: 'Account actions',  icon: <AlertTriangle size={18} /> },
];

export function SettingsView() {
  const [activeSection, setActiveSection] = useState<SectionId>('profile');

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
          {activeSection === 'profile'       && <ProfileSection />}
          {activeSection === 'privacy'       && <PrivacySection />}
          {activeSection === 'permissions'   && <PermissionsSection />}
          {activeSection === 'notifications' && <NotificationsSection />}
          {activeSection === 'account'       && <AccountSection />}
        </div>
      </div>
    </div>
  );
}

// ── Section components ─────────────────────────────────────────────────────────

function ProfileSection() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [editing, setEditing]         = useState(false);

  useEffect(() => { setDisplayName(user?.display_name ?? ''); }, [user?.display_name]);

  const { mutate: saveProfile, isLoading: saving } = useMutation(
    (payload: UpdateProfilePayload) => authApi.updateProfile(payload),
  );

  async function handleSaveName() {
    if (!displayName.trim()) return;
    try {
      await saveProfile({ display_name: displayName.trim() });
      await refreshUser();
      setEditing(false);
      toast('Display name updated.', 'ok');
    } catch (err) {
      toast(err instanceof AbhayaApiError ? err.message : 'Could not update name.', 'warn');
    }
  }

  return (
    <motion.div key="profile" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="settings-section">
      <Panel eyebrow="Account" icon={<User size={18} />} title="Profile">
        <div className="profile-avatar-row">
          <div className="profile-avatar">
            <User size={32} />
          </div>
          <div>
            <p className="profile-name">{user?.display_name ?? '—'}</p>
            <p className="profile-email">{user?.email ?? '—'}</p>
            <Badge tone={user?.role === 'admin' ? 'danger' : 'info'}>
              {user?.role === 'admin' ? 'Admin' : 'User'}
            </Badge>
          </div>
        </div>
        <div className="settings-field-list">
          <div className="settings-field">
            <div className="settings-field-icon"><User size={15} /></div>
            <div style={{ flex: 1 }}>
              <p className="settings-field-label">Display name</p>
              {editing ? (
                <div className="settings-name-edit-row">
                  <input
                    className="settings-name-input"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditing(false); }}
                    autoFocus
                    maxLength={64}
                  />
                  <Button size="sm" variant="secondary" onClick={handleSaveName} disabled={saving}>
                    {saving ? <Loader2 size={13} className="spin" /> : 'Save'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDisplayName(user?.display_name ?? ''); }}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="settings-field-value-row">
                  <p className="settings-field-value">{user?.display_name}</p>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
                </div>
              )}
              <p className="settings-field-hint">Visible only to you and admins if you reveal your identity during an incident.</p>
            </div>
          </div>
          <SettingsField icon={<Mail size={15} />} label="Email" value={user?.email ?? '—'} hint="Used for authentication only. Not shared with witnesses." />
          <SettingsField icon={<LockKeyhole size={15} />} label="Role" value={user?.role === 'admin' ? 'Admin' : 'User'} />
        </div>
      </Panel>
    </motion.div>
  );
}

function PrivacySection() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();

  const { mutate: updateProfile, isLoading: saving } = useMutation(
    (payload: UpdateProfilePayload) => authApi.updateProfile(payload),
  );

  async function toggle(field: keyof UpdateProfilePayload, currentVal: boolean) {
    const next = !currentVal;
    try {
      await updateProfile({ [field]: next } as UpdateProfilePayload);
      updateUser({ [field]: next });
      toast(
        field === 'witness_opt_in'
          ? (next ? 'Witness alerts enabled.' : 'Witness alerts disabled.')
          : (next ? 'Anonymous mode enabled.' : 'Anonymous mode disabled.'),
        next ? 'ok' : 'info',
      );
    } catch (err) {
      toast(err instanceof AbhayaApiError ? err.message : 'Could not update setting.', 'warn');
    }
  }

  return (
    <motion.div key="privacy" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="settings-section">
      <Panel eyebrow="Privacy" icon={<Shield size={18} />} title="Witness & privacy">
        <SettingsToggle
          icon={<Eye size={16} />}
          title="Receive witness alerts"
          description="Be alerted when someone nearby triggers an SOS. Your identity stays hidden unless you choose to reveal it."
          checked={user?.witness_opt_in ?? false}
          onToggle={() => toggle('witness_opt_in', user?.witness_opt_in ?? false)}
          disabled={saving}
          badge={user?.witness_opt_in ? <Badge tone="ok">Active</Badge> : <Badge tone="neutral">Off</Badge>}
        />
        <SettingsToggle
          icon={<MapPin size={16} />}
          title="Temporary location storage only"
          description="Location data is not retained after an incident resolves. This is always on and cannot be changed."
          checked
          onToggle={() => {}}
          disabled
        />
        <SettingsToggle
          icon={<EyeOff size={16} />}
          title="Anonymous by default"
          description="Your identity is always hidden in witness mode unless you explicitly reveal it during an incident."
          checked={user?.anonymous_by_default ?? true}
          onToggle={() => toggle('anonymous_by_default', user?.anonymous_by_default ?? true)}
          disabled={saving}
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
    { icon: <MapPin size={16} />, name: 'Location',           status: 'granted' as const, hint: 'Required for nearby alerts. Only used during active SOS.' },
    { icon: <Mic size={16} />,    name: 'Microphone',         status: 'prompt' as const,  hint: 'Optional. Used to capture audio evidence during SOS.' },
    { icon: <Camera size={16} />, name: 'Camera',             status: 'denied' as const,  hint: 'Optional. Used to capture video evidence during SOS.' },
    { icon: <Bell size={16} />,   name: 'Push notifications', status: 'prompt' as const,  hint: 'Recommended for witness alerts when the app is in the background.' },
  ];

  function requestPermission(name: string) {
    if (name === 'Location') navigator.geolocation?.getCurrentPosition(() => {});
    if (name === 'Microphone') navigator.mediaDevices?.getUserMedia({ audio: true }).catch(() => {});
    if (name === 'Camera') navigator.mediaDevices?.getUserMedia({ video: true }).catch(() => {});
    if (name === 'Push notifications') Notification?.requestPermission();
  }

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
                <Button variant="ghost" size="sm" onClick={() => requestPermission(p.name)}>Enable</Button>
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
  const [inApp, setInApp]             = useState(true);

  return (
    <motion.div key="notifs" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="settings-section">
      <Panel eyebrow="Alerts" icon={<Bell size={18} />} title="Notifications">
        <SettingsToggle
          icon={<Bell size={16} />}
          title="Push notifications"
          description="Receive witness alerts when Abhaya is in the background. Requires browser permission."
          checked={pushEnabled}
          onToggle={() => setPushEnabled((v) => !v)}
          badge={!pushEnabled ? <Badge tone="warn">Off</Badge> : undefined}
        />
        <SettingsToggle
          icon={<Smartphone size={16} />}
          title="In-app alerts"
          description="Show incident updates while Abhaya is open. Recommended as a fallback when push is off."
          checked={inApp}
          onToggle={() => setInApp((v) => !v)}
        />
      </Panel>
      {!pushEnabled && (
        <div className="settings-notice warn">
          <Bell size={14} />
          <p>Push notifications are off. You can still receive alerts while the app is open.</p>
        </div>
      )}
    </motion.div>
  );
}

function AccountSection() {
  const { toast } = useToast();

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
            onAction={() => toast('Evidence deletion is not yet available. Contact support.', 'info')}
          />
          <DangerAction
            icon={<AlertTriangle size={18} />}
            title="Delete account"
            description="Permanently delete your account and all associated data. This cannot be undone."
            buttonLabel="Delete my account"
            tone="danger"
            onAction={() => toast('Account deletion is not yet available. Contact support.', 'info')}
          />
        </div>
      </Panel>
    </motion.div>
  );
}

// ── Reusable primitives ────────────────────────────────────────────────────────

function SettingsField({ icon, label, value, hint }: {
  icon: React.ReactNode; label: string; value: string; hint?: string;
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
  icon: React.ReactNode; title: string; description: string;
  checked: boolean; onToggle: () => void; disabled?: boolean; badge?: React.ReactNode;
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
      <Switch checked={checked} label={`Toggle ${title}`} onClick={onToggle} disabled={disabled} />
    </div>
  );
}

function PermissionBadge({ status }: { status: 'granted' | 'denied' | 'prompt' }) {
  if (status === 'granted') return <Badge tone="ok">Granted</Badge>;
  if (status === 'denied')  return <Badge tone="danger">Denied</Badge>;
  return <Badge tone="warn">Not set</Badge>;
}

function DangerAction({ icon, title, description, buttonLabel, tone, onAction }: {
  icon: React.ReactNode; title: string; description: string;
  buttonLabel: string; tone: 'warn' | 'danger'; onAction: () => void;
}) {
  return (
    <div className={`danger-action-row tone-border-${tone}`}>
      <div className={`danger-action-icon tone-${tone}`}>{icon}</div>
      <div>
        <p className="danger-action-title">{title}</p>
        <p className="danger-action-desc">{description}</p>
      </div>
      <Button
        variant={tone === 'danger' ? 'danger' : 'secondary'}
        size="sm"
        onClick={onAction}
      >
        {buttonLabel}
      </Button>
    </div>
  );
}
