// ─── Supabase Client Initialization ──────────────────────────────────────────
// Connects to Supabase using EXPO_PUBLIC_ env vars with AsyncStorage for sessions

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isMockMode = !supabaseUrl || !supabaseAnonKey || supabaseUrl === '';

let supabase: SupabaseClient | null = null;

if (!isMockMode) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export { supabase };
export type { SupabaseClient };
