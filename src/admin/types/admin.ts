// ============================================================
//  AquaFlow Admin Panel — TypeScript Types
// ============================================================

export interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
  created_at: string;
}

export interface AdminModel {
  id: string;
  model_id: string;
  device_name: string;
  description: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  paired_count?: number;
}

export interface AdminDevice {
  id: string;
  mac_id: string;
  status: 'online' | 'offline';
  last_seen: string | null;
  user_email: string | null;
  user_name: string | null;
  user_id: string | null;
}

export interface WaterEvent {
  id: string;
  device_id: string;
  detected_at: string;
  water_level: string | number;
  device_mac?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  actor_id: string | null;
  actor_email: string | null;
  target_id: string | null;
  target_type: string | null;
  details: Record<string, any> | null;
  created_at: string;
}

export interface DashboardStats {
  totalUsers: number;
  totalAdmins: number;
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  totalModels: number;
  waterEventsToday: number;
  activeAlerts: number;
}

export interface AppSetting {
  key: string;
  value: string;
  updated_at?: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
}

export interface UpdateUserPayload {
  name?: string;
  role?: 'admin' | 'user';
  status?: 'active' | 'inactive';
}

export interface CreateModelPayload {
  model_id: string;
  device_name: string;
  description?: string;
  status: 'active' | 'inactive';
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

export const DEFAULT_ADMIN_EMAIL = 'admin123@gmail.com';
