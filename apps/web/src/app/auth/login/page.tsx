'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Mail, Lock, User, AlertTriangle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { AbhayaApiError, NetworkError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, displayName || email.split('@')[0]);
      }
      router.replace('/');
    } catch (err) {
      if (err instanceof AbhayaApiError) setError(err.message);
      else if (err instanceof NetworkError) setError(err.message);
      else setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(role: 'user' | 'admin' | 'witness') {
    const creds = {
      user:    { email: 'demo@abhaya.in',    pw: 'demo1234' },
      admin:   { email: 'admin@abhaya.in',   pw: 'admin1234' },
      witness: { email: 'witness@abhaya.in', pw: 'witness1234' },
    };
    setEmail(creds[role].email);
    setPassword(creds[role].pw);
    setMode('login');
  }

  return (
    <div className="auth-page">
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="auth-brand">
          <div className="auth-shield">
            <ShieldCheck size={28} />
          </div>
          <h1 className="auth-title">Abhaya</h1>
          <p className="auth-subtitle">Safety with reason</p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === 'login' ? 'is-active' : ''}`}
            onClick={() => { setMode('login'); setError(null); }}
            type="button"
          >
            Sign in
          </button>
          <button
            className={`auth-tab ${mode === 'register' ? 'is-active' : ''}`}
            onClick={() => { setMode('register'); setError(null); }}
            type="button"
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <AnimatePresence mode="wait">
            {mode === 'register' && (
              <motion.div
                key="name-field"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <div className="auth-field">
                  <label className="auth-label" htmlFor="display-name">
                    <User size={14} /> Display name
                  </label>
                  <input
                    id="display-name"
                    className="auth-input"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="auth-field">
            <label className="auth-label" htmlFor="email">
              <Mail size={14} /> Email
            </label>
            <input
              id="email"
              className="auth-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="password">
              <Lock size={14} /> Password
            </label>
            <input
              id="password"
              className="auth-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'At least 8 characters' : ''}
              required
              minLength={mode === 'register' ? 8 : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                className="auth-error"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <AlertTriangle size={14} />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            type="submit"
            variant="danger"
            size="lg"
            disabled={loading}
            icon={loading ? <Loader2 size={18} className="spin" /> : undefined}
            style={{ width: '100%', marginTop: '0.25rem' }}
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        <div className="auth-demo">
          <p className="auth-demo-label">Prototype demo accounts</p>
          <div className="auth-demo-buttons">
            <button className="auth-demo-btn" type="button" onClick={() => fillDemo('user')}>
              User
            </button>
            <button className="auth-demo-btn" type="button" onClick={() => fillDemo('witness')}>
              Witness
            </button>
            <button className="auth-demo-btn is-admin" type="button" onClick={() => fillDemo('admin')}>
              Admin
            </button>
          </div>
        </div>

        <p className="auth-disclaimer">
          This is a hackathon prototype. Do not use real personal data.
        </p>
      </motion.div>
    </div>
  );
}
