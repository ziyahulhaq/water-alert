import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

export const hasServiceRole = Boolean(serviceRoleKey);

// Only create admin client when service role key is present.
// This avoids the "Multiple GoTrueClient instances" warning in dev.
export const supabaseAdmin = hasServiceRole
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        storageKey: 'aquaflow-admin-auth', // unique key — prevents conflict
      },
    })
  : null as any; // will throw at call site if used without key
