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
    setStatus('Logged out.');
  };

  return (
    <div className="portal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="login-portal">
        <div className="energy-grid" />
        <div className="portal-particles">{Array.from({ length: 18 }, (_, i) => <i key={i} />)}</div>
        <button className="portal-close" onClick={onClose}>x</button>
        <div className="portal-kicker">STUDIO ACCOUNT</div>
        <h2>{user ? `Welcome ${user.name}.` : 'Sign in to play together.'}</h2>
        <p>Community chat, support, progress and profile sync use this identity.</p>
        {!supabaseReady && (
          <div className="auth-status">
            Supabase is not configured yet. Email starts a local studio session; Google login becomes real after Supabase env and the Google provider are enabled.
          </div>
        )}

        <button className="profile-avatar" onClick={() => input.current?.click()}>
          {image ? <img src={image} alt="DJ profile" /> : <span>DJ<small>ADD PHOTO</small></span>}
        </button>
        <input ref={input} type="file" accept="image/*" onChange={pick} hidden />

        <div className="auth-provider-row">
          <button className="auth-provider google" onClick={() => void signInWithGoogle()}>
            <span>G</span>
            Continue with Google
          </button>
        </div>

        <div className="auth-mode-row">
          <button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>Login</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Sign up</button>
        </div>

        <label>ARTIST NAME<input value={name} onChange={e => setName(e.target.value)} /></label>
        <label>EMAIL<input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>PASSWORD<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'Create a strong password' : 'Your password'} /></label>

        {status && <div className="auth-status">{status}</div>}
        <button className="enter-studio" onClick={() => void submitEmail()}>{mode === 'signup' ? 'CREATE ACCOUNT' : 'LOGIN'}</button>
        {user && <button className="auth-logout-btn" onClick={() => void logout()}>LOGOUT</button>}
      </div>
    </div>
  );
}
