import { supabase } from '../../lib/supabase';
import type { DashboardStats } from '../types/admin';

export async function getDashboardStats(): Promise<DashboardStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    usersRes,
    adminsRes,
    devicesRes,
    onlineRes,
    eventsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
    supabase.from('devices').select('id', { count: 'exact', head: true }),
    supabase.from('devices').select('id', { count: 'exact', head: true }).eq('status', 'online'),
    supabase.from('water_events')
      .select('id', { count: 'exact', head: true })
      .gte('detected_at', today.toISOString()),
  ]);

  const totalDevices = devicesRes.count ?? 0;
  const onlineDevices = onlineRes.count ?? 0;

  return {
    totalUsers: usersRes.count ?? 0,
    totalAdmins: adminsRes.count ?? 0,
    totalDevices,
    onlineDevices,
    offlineDevices: totalDevices - onlineDevices,
    waterEventsToday: eventsRes.count ?? 0,
    activeAlerts: onlineDevices,
  };
}
