import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

export interface AdminAuthState {
  user: any | null;
  profile: { id: string; email: string; name: string | null; role: string } | null;
  isAdmin: boolean;
  loading: boolean;
}

export function useAdminAuth(): AdminAuthState {
  const [user, setUser]       = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!mounted) return;

      if (!u) { setLoading(false); return; }

      setUser(u);
      const { data: p } = await supabase
        .from('profiles')
        .select('id, email, name, role')
        .eq('id', u.id)
        .single();

      if (mounted) {
        setProfile(p);
        setLoading(false);
      }
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e: AuthChangeEvent, session: Session | null) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      if (!session?.user) { setProfile(null); setLoading(false); }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  return {
    user,
    profile,
    isAdmin: profile?.role === 'admin',
    loading,
  };
}
