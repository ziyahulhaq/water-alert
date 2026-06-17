import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

// Admin client uses service_role key — bypasses RLS for admin operations.
// NEVER expose this key publicly — only use in secure admin contexts.
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey || '', {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export const hasServiceRole = Boolean(serviceRoleKey);
