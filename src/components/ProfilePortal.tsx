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
      setStatus('Google OAuth needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, plus Google enabled in Supabase Auth.');
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/api/auth/callback` },
    });
    if (error) setStatus(error.message);
  };

  const signInWithGitHub = async () => {
    if (!supabaseReady) {
      setStatus('GitHub OAuth needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, plus GitHub enabled in Supabase Auth.');
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${location.origin}/api/auth/callback` },
    });
    if (error) setStatus(error.message);
  };

  const submitEmail = async () => {
    setStatus(null);
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setStatus('Enter an email address.');
      return;
    }
    if (!supabaseReady) {
      const fallback = {
        id: `local-${cleanEmail}`,
        name: name.trim() || cleanEmail.split('@')[0],
        email: cleanEmail,
        avatar: image,
        provider: 'local',
      } satisfies StudioUser;
      setUser(fallback);
      localStorage.setItem('studio-user', JSON.stringify(fallback));
      setStatus('Local studio session started. Supabase keys enable cloud login.');
      return;
    }
    const supabase = createClient();
    const action = mode === 'signup'
      ? supabase.auth.signUp({ email: cleanEmail, password, options: { data: { full_name: name } } })
      : supabase.auth.signInWithPassword({ email: cleanEmail, password });
    const { data, error } = await action;
    if (error) setStatus(error.message);
    else if (data.user) {
      setUser(userFromSupabase(data.user));
      setStatus(mode === 'signup' ? 'Account created. Check your email if confirmation is enabled.' : 'Signed in.');
    }
  };

  const logout = async () => {
    if (supabaseReady) await createClient().auth.signOut();
    localStorage.removeItem('studio-user');
    setUser(null);
    setMode('signin');
    setPassword('');
    setStatus('Logged out.');
  };

  return (
    <div className="portal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="login-portal">
        <div className="energy-grid" />
        <div className="portal-particles">{Array.from({ length: 18 }, (_, i) => <i key={i} />)}</div>
        <button className="portal-close" onClick={onClose} aria-label="Close">&times;</button>

        <div className="portal-header">
          <div className="portal-kicker">AI DJ STUDIO</div>
          <h2>{user ? 'Welcome back.' : 'Join the Session.'}</h2>
          <p>{user ? 'You are signed in and ready for community, support and progress sync.' : 'Sync your sets, unlock AI features, and join the community.'}</p>
        </div>

        {!supabaseReady && (
          <div className="auth-status auth-status-warn">
            <span className="auth-status-icon">⚙</span>
            Supabase is not configured. Email starts a local studio session; OAuth becomes active once Supabase env keys and providers are enabled.
          </div>
        )}

        {/* Avatar */}
        <button className="profile-avatar" onClick={() => input.current?.click()} title="Edit profile photo">
          {image ? <img src={image} alt="DJ profile" /> : (
            <span className="profile-avatar-placeholder">
              <svg viewBox="0 0 24 24" fill="currentColor" width="38" height="38"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
              <small>ADD PHOTO</small>
            </span>
          )}
          <i className="profile-edit-icon">✎</i>
        </button>
        <input ref={input} type="file" accept="image/*" onChange={pick} hidden />

        {user ? (
          <div className="signed-in-card">
            <div className="signed-in-badge">
              {user.provider === 'google' ? '● Google' : user.provider === 'github' ? '● GitHub' : user.provider === 'local' ? '◌ Local' : '● Email'}&nbsp;Connected
            </div>
            <b>{user.name}</b>
            <small>{user.email || 'No public email shown'}</small>
            <button className="support-submit" style={{ marginTop: '0.35rem' }} onClick={() => input.current?.click()}>Edit Photo</button>
          </div>
        ) : (
          <>
            {/* OAuth provider buttons */}
            <div className="auth-provider-row">
              <button className="auth-provider google" onClick={() => void signInWithGoogle()}>
                {/* Google G SVG logo */}
                <svg className="auth-provider-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <button className="auth-provider github" onClick={() => void signInWithGitHub()}>
                {/* GitHub Octocat SVG logo */}
                <svg className="auth-provider-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                </svg>
                Continue with GitHub
              </button>
            </div>

            <div className="auth-divider"><span>or</span></div>

            {/* Login / Sign up toggle */}
            <div className="auth-mode-row">
              <button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>Sign In</button>
              <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Sign Up</button>
            </div>

            {mode === 'signup' && (
              <label className="auth-field-label">
                ARTIST NAME
                <input className="auth-field" value={name} onChange={e => setName(e.target.value)} placeholder="Your DJ name" />
              </label>
            )}
            <label className="auth-field-label">
              EMAIL
              <input className="auth-field" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            <label className="auth-field-label">
              PASSWORD
              <input className="auth-field" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'Create a strong password' : 'Your password'} />
            </label>
          </>
        )}

        {status && <div className={`auth-status${status.toLowerCase().includes('error') || status.toLowerCase().includes('needs') ? ' auth-status-warn' : ''}`}>{status}</div>}

        {!user && (
          <button className="enter-studio" onClick={() => void submitEmail()}>
            {mode === 'signup' ? 'CREATE ACCOUNT' : 'SIGN IN'}
          </button>
        )}
        {user && <button className="auth-logout-btn" onClick={() => void logout()}>SIGN OUT</button>}
      </div>
    </div>
  );
}
