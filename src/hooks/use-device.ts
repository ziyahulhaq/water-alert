// ─── Device Data Hook ────────────────────────────────────────────────────────
// Fetches the user's linked devices, latest water events, and notification settings

import { useCallback, useEffect, useState } from 'react';
import { db } from '@/lib/storage-client';
import { useAuth } from './use-auth';
import type { Device, WaterEvent, NotificationSettings, Profile } from '@/types/database';

interface DeviceData {
  device: Device | null;
  recentEvents: WaterEvent[];
  allEvents: WaterEvent[];
  latestEvent: WaterEvent | null;
  profile: Profile | null;
  notificationSettings: NotificationSettings | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDevice(): DeviceData {
  const { user } = useAuth();
  const [device, setDevice] = useState<Device | null>(null);
  const [recentEvents, setRecentEvents] = useState<WaterEvent[]>([]);
  const [allEvents, setAllEvents] = useState<WaterEvent[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 1. Fetch user profile
      const { data: profileData } = await db
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setProfile(profileData);

      // 2. Fetch linked device IDs
      const { data: links } = await db
        .from('user_device')
        .select('*')
        .eq('user_id', user.id);

      if (!links || links.length === 0) {
        setDevice(null);
        setRecentEvents([]);
        setAllEvents([]);
        setLoading(false);
        return;
      }

      const deviceIds = links.map((l: { device_id: string }) => l.device_id);

      // 3. Fetch device(s) - use first linked device as primary
      const { data: devices } = await db
        .from('devices')
        .select('*')
        .in('id', deviceIds);

      const primaryDevice = devices?.[0] ?? null;
      setDevice(primaryDevice);

      // 4. Fetch water events for linked devices
      if (primaryDevice) {
        // Recent 5
        const { data: recent } = await db
          .from('water_events')
          .select('*')
          .eq('device_id', primaryDevice.id)
          .order('detected_at', { ascending: false })
          .limit(5);
        setRecentEvents(recent ?? []);

        // All events (last 50) for history
        const { data: all } = await db
          .from('water_events')
          .select('*')
          .eq('device_id', primaryDevice.id)
          .order('detected_at', { ascending: false })
          .limit(50);
        setAllEvents(all ?? []);
      }

      // 5. Fetch notification settings
      const { data: notifData } = await db
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      setNotificationSettings(notifData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    device,
    recentEvents,
    allEvents,
    latestEvent: recentEvents[0] ?? null,
    profile,
    notificationSettings,
    loading,
    error,
    refresh: fetchData,
  };
}
