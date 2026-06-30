// ─── Database Type Definitions ───────────────────────────────────────────────
// TypeScript interfaces matching the Supabase PostgreSQL schema

export interface Profile {
  id: string;
  email: string | null;
  link_token: string | null;
  chat_id: string | null;
  push_token: string | null;
  created_at: string | null;
}

export interface Device {
  id: string;
  mac_hash: string | null;
  model_id: string | null;
  status: 'online' | 'offline';
  last_seen: string | null;
  threshold_no_water_max: number;
  threshold_low_max: number;
  threshold_medium_max: number;
  alert_threshold: number;
  reset_threshold: number;
  created_at?: string;
}

export interface UserDevice {
  id: string;
  user_id: string;
  device_id: string;
  created_at?: string;
}

export interface WaterEvent {
  id: string;
  device_id: string;
  water_level: number; // 0=No Water, 1=Low, 2=Medium, 3=High
  sensor_value: number;
  uptime_sec: number;
  event_type: 'arrived' | 'stopped' | 'heartbeat';
  detected_at: string;
}

export interface NotificationSettings {
  id: string;
  user_id: string;
  whatsapp_number: string | null;
  enabled: boolean;
}

// ─── Water Level Helpers ─────────────────────────────────────────────────────

export const WATER_LEVEL_LABELS: Record<number, string> = {
  0: 'No Water',
  1: 'Low',
  2: 'Medium',
  3: 'High',
};

export const WATER_LEVEL_COLORS: Record<number, string> = {
  0: '#6B7280', // gray
  1: '#F59E0B', // amber
  2: '#3B82F6', // blue
  3: '#10B981', // emerald
};

export type EventType = 'arrived' | 'stopped' | 'heartbeat';
