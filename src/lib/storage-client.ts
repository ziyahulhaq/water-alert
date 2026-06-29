// ─── Unified Storage Client ──────────────────────────────────────────────────
// Exports a single `db` object that works the same whether using real Supabase or mock
// Auto-detects mode based on presence of EXPO_PUBLIC_SUPABASE_URL env var

import { supabase, isMockMode } from './supabase';
import { mockSupabase } from './mock-storage';

export { isMockMode };

// The unified client. Callers use `db.auth` and `db.from()` identically.
// In mock mode, everything runs against AsyncStorage.
// In live mode, everything runs against the real Supabase instance.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db: any = isMockMode ? mockSupabase : supabase;

/**
 * Helper to get the real Supabase client (only when NOT in mock mode).
 * Throws if called in mock mode. Use only when you need Supabase-specific features
 * like realtime subscriptions.
 */
export function getSupabaseClient() {
  if (isMockMode || !supabase) {
    throw new Error('Supabase client is not available in mock mode');
  }
  return supabase;
}
