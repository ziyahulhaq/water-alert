import { supabase } from '../../lib/supabase';
import type { AdminDevice } from '../types/admin';
import { logAudit } from './adminAudit';

export async function listDevices(): Promise<AdminDevice[]> {
  const { data, error } = await supabase
    .from('admin_devices_view')
    .select('*')
    .order('last_seen', { ascending: false, nullsFirst: false });

  if (error) {
    // Fallback if view doesn't exist yet
    const { data: raw, error: rawError } = await supabase
      .from('devices')
      .select('id, mac_hash, model_id, status, last_seen');
    if (rawError) throw rawError;
    return (raw ?? []).map(d => ({ ...d, user_email: null, user_name: null, user_id: null })) as AdminDevice[];
  }

  return (data ?? []) as AdminDevice[];
}

export async function updateDeviceStatus(deviceId: string, status: 'online' | 'offline', actorId: string, actorEmail: string): Promise<void> {
  const { error } = await supabase.from('devices').update({ status }).eq('id', deviceId);
  if (error) throw error;
  await logAudit('DEVICE_STATUS_CHANGED', actorId, actorEmail, deviceId, 'device', { status });
}

export async function removeDevice(deviceId: string, actorId: string, actorEmail: string): Promise<void> {
  // Remove junction first
  await supabase.from('user_device').delete().eq('device_id', deviceId);
  const { error } = await supabase.from('devices').delete().eq('id', deviceId);
  if (error) throw error;
  await logAudit('DEVICE_REMOVED', actorId, actorEmail, deviceId, 'device');
}
