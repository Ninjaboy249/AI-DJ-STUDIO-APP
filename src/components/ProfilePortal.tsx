'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { getSupabaseConfig } from '@/lib/env';
import type { StudioUser } from './App';

interface Props {
  open: boolean;
  onClose: () => void;
  image: string | null;
  setImage: (v: string) => void;
  user: StudioUser | null;
  setUser: (v: StudioUser | null) => void;
}
function userFromSupabase(user: User): StudioUser {
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    name: meta.full_name ?? meta.name ?? user.email?.split('@')[0] ?? 'DJ',
    email: user.email ?? '',
    avatar: meta.avatar_url ?? null,
    provider: (user.app_metadata?.provider as StudioUser['provider']) ?? 'email',
  };
}

export default function ProfilePortal({ open, onClose, image, setImage, user, setUser }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.name ?? 'DJ Nova');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState<'google' | 'github' | 'email' | null>(null);

  const supabaseReady = useMemo(() => {
    const cfg = getSupabaseConfig();
    return Boolean(cfg.url && cfg.anonKey);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('studio-user');
      if (!raw) return;
      const saved = JSON.parse(raw) as StudioUser;
      setUser(saved);
      setName(saved.name);
      setEmail(saved.email);
    } catch {}
  }, [setUser]);

  useEffect(() => {
    if (!supabaseReady) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(userFromSupabase(data.user));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ? userFromSupabase(session.user) : null);
    });
    return () => subscription.unsubscribe();
  }, [setUser, supabaseReady]);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      if (user.avatar && !image) setImage(user.avatar);
    }
  }, [image, setImage, user]);

  if (!open) return null;

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setImage(URL.createObjectURL(file));
  };

  const signInWithGoogle = async () => {
    if (!supabaseReady) {
      setStatus('Google OAuth requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, plus Google enabled in Supabase Auth.');
      return;
    }
    setLoading('google');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/api/auth/callback` },
    });
    if (error) { setStatus(error.message); setLoading(null); }
  };

  const signInWithGitHub = async () => {
    if (!supabaseReady) {
      setStatus('GitHub OAuth requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, plus GitHub enabled in Supabase Auth.');
      return;
    }
    setLoading('github');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${location.origin}/api/auth/callback` },
    });
    if (error) { setStatus(error.message); setLoading(null); }
  };

  const submitEmail = async () => {
    setStatus(null);
    const cleanEmail = email.trim();
    if (!cleanEmail) { setStatus('Enter an email address.'); return; }
    if (!supabaseReady) {
      const fallback: StudioUser = {
        id: `local-${cleanEmail}`,
        name: name.trim() || cleanEmail.split('@')[0],
        email: cleanEmail,
        avatar: image,
        provider: 'local',
      };
      setUser(fallback);
      localStorage.setItem('studio-user', JSON.stringify(fallback));
      setStatus('Local studio session started. Add Supabase env keys to enable cloud sync.');
      return;
    }
    setLoading('email');
    const supabase = createClient();
    const action = mode === 'signup'
      ? supabase.auth.signUp({ email: cleanEmail, password, options: { data: { full_name: name } } })
      : supabase.auth.signInWithPassword({ email: cleanEmail, password });
    const { data, error } = await action;
    setLoading(null);
    if (error) setStatus(error.message);
    else if (data.user) {
      setUser(userFromSupabase(data.user));
      setStatus(mode === 'signup' ? 'Account created. Check your email if confirmation is enabled.' : 'Signed in successfully.');
    }
  };

  const logout = async () => {
    if (supabaseReady) await createClient().auth.signOut();
    localStorage.removeItem('studio-user');
    setUser(null);
    setMode('signin');
    setPassword('');
    setStatus('Signed out.');
  };

  const isError = (s: string) =>
    s.toLowerCase().includes('error') ||
    s.toLowerCase().includes('requires') ||
    s.toLowerCase().includes('invalid') ||
    s.toLowerCase().includes('needs');

  return (
    <div className="portal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="lp-card">
        {/* ── Animated glow border layer ── */}
        <div className="lp-glow-ring" aria-hidden />

        {/* ── Left branding panel ── */}
        <div className="lp-brand">
          <div className="lp-brand-inner">
            <div className="lp-logo-mark" aria-hidden>
              {/* Vinyl record SVG */}
              <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="60" cy="60" r="58" stroke="url(#vg1)" strokeWidth="2" fill="rgba(0,0,0,.55)" />
                <circle cx="60" cy="60" r="44" stroke="rgba(0,229,255,.15)" strokeWidth="1" fill="none" />
                <circle cx="60" cy="60" r="30" stroke="rgba(0,229,255,.1)" strokeWidth="1" fill="none" />
                <circle cx="60" cy="60" r="16" stroke="rgba(0,229,255,.18)" strokeWidth="1" fill="none" />
                <circle cx="60" cy="60" r="7" fill="url(#vg2)" />
                <circle cx="60" cy="60" r="3.5" fill="rgba(0,229,255,.9)" />
                <defs>
                  <linearGradient id="vg1" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#00e5ff" /><stop offset="1" stopColor="#e040fb" />
                  </linearGradient>
                  <radialGradient id="vg2" cx="50%" cy="50%" r="50%">
                    <stop stopColor="#e040fb" /><stop offset="1" stopColor="#7c3aed" />
                  </radialGradient>
                </defs>
              </svg>
            </div>

            <div className="lp-brand-kicker">AI DJ STUDIO</div>
            <h1 className="lp-brand-title">Drop&nbsp;Your<br />Best&nbsp;Mix.</h1>
            <p className="lp-brand-sub">
              AI-powered mixing, beat analysis, and real-time VR performance.
              Sign in to save sets and unlock every feature.
            </p>

            {/* Animated waveform bars */}
            <div className="lp-wave" aria-hidden>
              {Array.from({ length: 22 }, (_, i) => (
                <span key={i} className="lp-wave-bar" style={{ animationDelay: `${(i * 0.09).toFixed(2)}s` }} />
              ))}
            </div>

            <div className="lp-brand-features">
              <span>🎛 AI EQ</span>
              <span>🔥 Beat Sync</span>
              <span>🥽 VR Stage</span>
            </div>
          </div>
        </div>

        {/* ── Right form panel ── */}
        <div className="lp-form">
          <button className="lp-close" onClick={onClose} aria-label="Close portal">
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>

          {/* Avatar */}
          <button className="lp-avatar" onClick={() => input.current?.click()} title="Edit profile photo">
            {image
              ? <img src={image} alt="DJ profile" className="lp-avatar-img" />
              : (
                <span className="lp-avatar-placeholder">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="34" height="34"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" /></svg>
                  <small>ADD PHOTO</small>
                </span>
              )}
            <span className="lp-avatar-edit">✎</span>
          </button>
          <input ref={input} type="file" accept="image/*" onChange={pick} hidden />

          {!supabaseReady && (
            <div className="lp-notice">
              <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15" style={{ flexShrink: 0, marginTop: 1 }}><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
              Supabase not configured — OAuth is ready once env keys &amp; providers are enabled. Email starts a local session.
            </div>
          )}

          {user ? (
            /* ── Signed-in state ── */
            <div className="lp-signedin">
              <div className="lp-signedin-badge">
                {user.provider === 'google' && (
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                {user.provider === 'github' && (
                  <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden>
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                  </svg>
                )}
                {user.provider === 'google' ? 'Google' : user.provider === 'github' ? 'GitHub' : user.provider === 'local' ? 'Local' : 'Email'}&nbsp;Connected
              </div>
              <div className="lp-signedin-name">{user.name}</div>
              <div className="lp-signedin-email">{user.email || 'No public email shown'}</div>
              <button className="lp-secondary-btn" onClick={() => input.current?.click()}>Change Photo</button>
              {status && <div className={`lp-status${isError(status) ? ' lp-status-warn' : ' lp-status-ok'}`}>{status}</div>}
              <button className="lp-danger-btn" onClick={() => void logout()}>SIGN OUT</button>
            </div>
          ) : (
            /* ── Auth form ── */
            <>
              <div className="lp-heading">
                <h2 className="lp-title">{mode === 'signup' ? 'Create Account' : 'Welcome Back'}</h2>
                <p className="lp-sub">{mode === 'signup' ? 'Join thousands of AI DJs.' : 'Pick up where you left off.'}</p>
              </div>

              {/* OAuth row */}
              <div className="lp-oauth-row">
                <button
                  className={`lp-oauth lp-oauth-google${loading === 'google' ? ' lp-oauth-loading' : ''}`}
                  onClick={() => void signInWithGoogle()}
                  disabled={loading !== null}
                >
                  <svg className="lp-oauth-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {loading === 'google' ? 'Redirecting…' : 'Continue with Google'}
                </button>

                <button
                  className={`lp-oauth lp-oauth-github${loading === 'github' ? ' lp-oauth-loading' : ''}`}
                  onClick={() => void signInWithGitHub()}
                  disabled={loading !== null}
                >
                  <svg className="lp-oauth-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                  </svg>
                  {loading === 'github' ? 'Redirecting…' : 'Continue with GitHub'}
                </button>
              </div>

              {/* Divider */}
              <div className="lp-divider"><span>or {mode === 'signup' ? 'sign up' : 'sign in'} with email</span></div>

              {/* Mode toggle */}
              <div className="lp-mode-row">
                <button className={mode === 'signin' ? 'active' : ''} onClick={() => { setMode('signin'); setStatus(null); }}>Sign In</button>
                <button className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setStatus(null); }}>Sign Up</button>
              </div>

              {mode === 'signup' && (
                <label className="lp-field-label">
                  ARTIST NAME
                  <input className="lp-field" value={name} onChange={e => setName(e.target.value)} placeholder="Your DJ name" autoComplete="name" />
                </label>
              )}
              <label className="lp-field-label">
                EMAIL
                <input className="lp-field" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
              </label>
              <label className="lp-field-label">
                PASSWORD
                <input className="lp-field" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'Create a strong password' : 'Your password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
              </label>

              {status && <div className={`lp-status${isError(status) ? ' lp-status-warn' : ' lp-status-ok'}`}>{status}</div>}

              <button
                className={`lp-submit-btn${loading === 'email' ? ' lp-loading' : ''}`}
                onClick={() => void submitEmail()}
                disabled={loading !== null}
              >
                {loading === 'email' ? 'Please wait…' : mode === 'signup' ? 'CREATE ACCOUNT' : 'SIGN IN'}
              </button>

              <p className="lp-terms">
                By continuing you agree to the&nbsp;
                <a href="#" className="lp-link">Terms of Service</a> and&nbsp;
                <a href="#" className="lp-link">Privacy Policy</a>.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
