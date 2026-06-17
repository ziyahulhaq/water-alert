import { supabase } from '../../lib/supabase';
import type { WaterEvent } from '../types/admin';

export async function listEvents(opts?: { search?: string; dateFrom?: string; dateTo?: string; limit?: number }): Promise<WaterEvent[]> {
  let query = supabase
    .from('water_events')
    .select('id, device_id, detected_at, water_level, devices(mac_id)')
    .order('detected_at', { ascending: false })
    .limit(opts?.limit ?? 100);

  if (opts?.dateFrom) query = query.gte('detected_at', opts.dateFrom);
  if (opts?.dateTo)   query = query.lte('detected_at', opts.dateTo);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((e: any) => ({
    id: e.id,
    device_id: e.device_id,
    detected_at: e.detected_at,
    water_level: e.water_level,
    device_mac: e.devices?.mac_id ?? e.device_id,
  }));
}

export function exportEventsCSV(events: WaterEvent[]): void {
  const headers = ['ID', 'Device', 'Detected At', 'Water Level'];
  const rows = events.map(e => [
    e.id,
    e.device_mac ?? e.device_id,
    new Date(e.detected_at).toLocaleString(),
    String(e.water_level),
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(v => `"${v.replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `water_events_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
