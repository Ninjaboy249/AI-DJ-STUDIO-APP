'use client';
// AuthButton — minimal Google OAuth login/logout with Supabase.

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const signIn = () =>
    supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/api/auth/callback` } });

  const signOut = () => supabase.auth.signOut().then(() => setUser(null));

  if (!user) {
    return (
      <button
        className="btn ai-toggle-btn"
        onClick={signIn}
        title="Sign in with Google"
      >
        Sign in
      </button>
    );
  }
  return (
    <button
      className="btn ai-toggle-btn"
      onClick={signOut}
      title={`Signed in as ${user.email}`}
    >
      {user.email?.split('@')[0]} ↗
    </button>
  );
}
