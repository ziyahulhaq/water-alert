import { supabase } from '../../lib/supabase';
import { supabaseAdmin, hasServiceRole } from '../../lib/supabaseAdmin';
import type { AdminUser, CreateUserPayload, UpdateUserPayload } from '../types/admin';
import { DEFAULT_ADMIN_EMAIL } from '../types/admin';
import { logAudit } from './adminAudit';

export async function listUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, role, status, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as AdminUser[];
}

export async function createUser(payload: CreateUserPayload, actorId: string, actorEmail: string): Promise<AdminUser> {
  if (!hasServiceRole) {
    throw new Error('Service role key not configured. Add VITE_SUPABASE_SERVICE_ROLE_KEY to .env');
  }

  // 1. Create auth user via Admin API
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: payload.email,
    password: payload.password,
    email_confirm: true,
    user_metadata: { name: payload.name },
  });

  if (authError) throw authError;
  const userId = authData.user.id;

  // 2. Upsert profile with role + status
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: userId,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      status: payload.status,
    })
    .select()
    .single();

  if (profileError) throw profileError;

  await logAudit('USER_CREATED', actorId, actorEmail, userId, 'user', { email: payload.email, role: payload.role });

  return profile as AdminUser;
}

export async function updateUser(userId: string, updates: UpdateUserPayload, actorId: string, actorEmail: string): Promise<void> {
  // Guard: can't demote the default admin
  const { data: target } = await supabase.from('profiles').select('email, role').eq('id', userId).single();
  if (target?.email === DEFAULT_ADMIN_EMAIL && updates.role === 'user') {
    throw new Error('Cannot change the role of the default Super Admin account.');
  }

  // Guard: can't remove the last admin
  if (updates.role === 'user') {
    const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin');
    if ((count ?? 0) <= 1) throw new Error('Cannot demote the last admin account.');
  }

  // Strip password — profiles table has no password column.
  // Password changes must go through Supabase Auth API separately.
  const { password: _pw, email: _email, ...profileUpdates } = updates as any;
  const { error } = await supabase.from('profiles').update(profileUpdates).eq('id', userId);
  if (error) throw error;

  await logAudit('USER_UPDATED', actorId, actorEmail, userId, 'user', updates);
}

export async function deleteUser(userId: string, actorId: string, actorEmail: string): Promise<void> {
  if (!hasServiceRole) throw new Error('Service role key not configured.');

  // Guard: can't delete yourself
  if (userId === actorId) throw new Error('You cannot delete your own account.');

  // Guard: can't delete default admin
  const { data: target } = await supabase.from('profiles').select('email, role').eq('id', userId).single();
  if (target?.email === DEFAULT_ADMIN_EMAIL) throw new Error('Cannot delete the default Super Admin account.');

  // Guard: can't delete last admin
  if (target?.role === 'admin') {
    const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin');
    if ((count ?? 0) <= 1) throw new Error('Cannot delete the last admin account.');
  }

  // Delete auth user (cascades to profile via trigger or FK)
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authError) throw authError;

  // Delete profile manually in case trigger doesn't cascade
  await supabaseAdmin.from('profiles').delete().eq('id', userId);

  await logAudit('USER_DELETED', actorId, actorEmail, userId, 'user', { email: target?.email });
}

export async function toggleUserStatus(userId: string, status: 'active' | 'inactive', actorId: string, actorEmail: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ status }).eq('id', userId);
  if (error) throw error;
  await logAudit('USER_STATUS_CHANGED', actorId, actorEmail, userId, 'user', { status });
}
