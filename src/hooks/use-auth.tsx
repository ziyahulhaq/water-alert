// ─── Authentication Context & Hook ───────────────────────────────────────────
// Provides auth state, sign in/up/out methods throughout the app

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { db, isMockMode } from '@/lib/storage-client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isMockMode: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isMockMode: false,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
});

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to auth state changes
    const { data } = db.auth.onAuthStateChange(
      (event: string, session: { user: AuthUser } | null) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email ?? '',
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => {
      data?.subscription?.unsubscribe?.();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: error.message ?? 'Sign in failed' };
    }
    return { error: null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await db.auth.signUp({ email, password });
    if (error) {
      return { error: error.message ?? 'Sign up failed' };
    }
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await db.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, isMockMode, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
