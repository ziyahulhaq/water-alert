// ─── AsyncStorage Mock Database ──────────────────────────────────────────────
// Full mock implementation when Supabase env vars are missing (sandbox/demo mode)
// Simulates auth, database queries, inserts, updates, and upserts via AsyncStorage

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Device,
  NotificationSettings,
  Profile,
  UserDevice,
  WaterEvent,
} from '@/types/database';

// ─── Storage Keys ────────────────────────────────────────────────────────────

const KEYS = {
  CURRENT_USER: '@mock:current_user',
  PROFILES: '@mock:profiles',
  DEVICES: '@mock:devices',
  USER_DEVICES: '@mock:user_devices',
  WATER_EVENTS: '@mock:water_events',
  NOTIFICATION_SETTINGS: '@mock:notification_settings',
} as const;

// ─── ID Generation ───────────────────────────────────────────────────────────

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Generic Storage Helpers ─────────────────────────────────────────────────

async function getCollection<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

async function setCollection<T>(key: string, data: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(data));
}

// ─── Seed Data ───────────────────────────────────────────────────────────────

const DEMO_DEVICE: Device = {
  id: 'demo-device-001',
  mac_hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  model_id: 'WD-DEMO01',
  status: 'online',
  last_seen: new Date().toISOString(),
  threshold_no_water_max: 150,
  threshold_low_max: 600,
  threshold_medium_max: 1200,
  alert_threshold: 601,
  reset_threshold: 150,
};

function generateSeedEvents(deviceId: string): WaterEvent[] {
  const events: WaterEvent[] = [];
  const now = Date.now();
  const types: Array<'arrived' | 'stopped'> = ['arrived', 'stopped'];

  for (let i = 0; i < 10; i++) {
    const hoursAgo = i * 3 + Math.floor(Math.random() * 2);
    const type = types[i % 2];
    events.push({
      id: generateUUID(),
      device_id: deviceId,
      water_level: type === 'arrived' ? 3 : 0,
      sensor_value: type === 'arrived' ? 850 : 120,
      uptime_sec: 3600 * (10 - i),
      event_type: type,
      detected_at: new Date(now - hoursAgo * 3600 * 1000).toISOString(),
    });
  }
  return events;
}

// ─── Initialize Demo Data ────────────────────────────────────────────────────

export async function initializeMockData(): Promise<void> {
  const existing = await AsyncStorage.getItem(KEYS.DEVICES);
  if (existing) return; // Already seeded

  await setCollection(KEYS.DEVICES, [DEMO_DEVICE]);
  await setCollection(KEYS.WATER_EVENTS, generateSeedEvents(DEMO_DEVICE.id));
  await setCollection(KEYS.PROFILES, []);
  await setCollection(KEYS.USER_DEVICES, []);
  await setCollection(KEYS.NOTIFICATION_SETTINGS, []);
}

// ─── Mock Auth ───────────────────────────────────────────────────────────────

export interface MockUser {
  id: string;
  email: string;
}

export interface MockSession {
  user: MockUser;
  access_token: string;
}

type AuthChangeCallback = (event: string, session: MockSession | null) => void;
const authListeners: AuthChangeCallback[] = [];

function notifyAuthListeners(event: string, session: MockSession | null) {
  authListeners.forEach((cb) => cb(event, session));
}

export const mockAuth = {
  async signUp(email: string, _password: string) {
    await initializeMockData();
    const profiles = await getCollection<Profile>(KEYS.PROFILES);
    const existingProfile = profiles.find((p) => p.email === email);
    if (existingProfile) {
      return { data: null, error: { message: 'User already exists' } };
    }

    const userId = generateUUID();
    const linkToken = generateUUID();
    const profile: Profile = {
      id: userId,
      email,
      link_token: linkToken,
      chat_id: null,
      push_token: null,
      created_at: new Date().toISOString(),
    };
    profiles.push(profile);
    await setCollection(KEYS.PROFILES, profiles);

    // Auto-link demo device
    const userDevices = await getCollection<UserDevice>(KEYS.USER_DEVICES);
    userDevices.push({
      id: generateUUID(),
      user_id: userId,
      device_id: DEMO_DEVICE.id,
    });
    await setCollection(KEYS.USER_DEVICES, userDevices);

    const session: MockSession = {
      user: { id: userId, email },
      access_token: `mock-token-${userId}`,
    };
    await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(session));
    notifyAuthListeners('SIGNED_IN', session);

    return { data: { user: session.user, session }, error: null };
  },

  async signInWithPassword(email: string, _password: string) {
    await initializeMockData();
    const profiles = await getCollection<Profile>(KEYS.PROFILES);
    const profile = profiles.find((p) => p.email === email);

    if (!profile) {
      return { data: null, error: { message: 'Invalid login credentials' } };
    }

    const session: MockSession = {
      user: { id: profile.id, email: profile.email ?? email },
      access_token: `mock-token-${profile.id}`,
    };
    await AsyncStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(session));
    notifyAuthListeners('SIGNED_IN', session);

    return { data: { user: session.user, session }, error: null };
  },

  async signOut() {
    await AsyncStorage.removeItem(KEYS.CURRENT_USER);
    notifyAuthListeners('SIGNED_OUT', null);
    return { error: null };
  },

  async getSession() {
    const raw = await AsyncStorage.getItem(KEYS.CURRENT_USER);
    if (!raw) return { data: { session: null }, error: null };
    const session = JSON.parse(raw) as MockSession;
    return { data: { session }, error: null };
  },

  async getUser() {
    const raw = await AsyncStorage.getItem(KEYS.CURRENT_USER);
    if (!raw) return { data: { user: null }, error: null };
    const session = JSON.parse(raw) as MockSession;
    return { data: { user: session.user }, error: null };
  },

  onAuthStateChange(callback: AuthChangeCallback) {
    authListeners.push(callback);
    // Immediately fire with current state
    AsyncStorage.getItem(KEYS.CURRENT_USER).then((raw) => {
      if (raw) {
        const session = JSON.parse(raw) as MockSession;
        callback('INITIAL_SESSION', session);
      } else {
        callback('INITIAL_SESSION', null);
      }
    });
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            const idx = authListeners.indexOf(callback);
            if (idx > -1) authListeners.splice(idx, 1);
          },
        },
      },
    };
  },
};

// ─── Mock Query Builder ──────────────────────────────────────────────────────

type FilterOp = 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'in';

interface QueryFilter {
  column: string;
  op: FilterOp;
  value: unknown;
}

function applyFilters<T extends Record<string, unknown>>(
  items: T[],
  filters: QueryFilter[]
): T[] {
  return items.filter((item) =>
    filters.every((f) => {
      const val = item[f.column];
      switch (f.op) {
        case 'eq':
          return val === f.value;
        case 'neq':
          return val !== f.value;
        case 'lt':
          return (val as number) < (f.value as number);
        case 'lte':
          return (val as number) <= (f.value as number);
        case 'gt':
          return (val as number) > (f.value as number);
        case 'gte':
          return (val as number) >= (f.value as number);
        case 'in':
          return (f.value as unknown[]).includes(val);
        default:
          return true;
      }
    })
  );
}

// ─── Table Key Map ───────────────────────────────────────────────────────────

const TABLE_KEYS: Record<string, string> = {
  profiles: KEYS.PROFILES,
  devices: KEYS.DEVICES,
  user_device: KEYS.USER_DEVICES,
  water_events: KEYS.WATER_EVENTS,
  notification_settings: KEYS.NOTIFICATION_SETTINGS,
};

// ─── Mock Query Chain ────────────────────────────────────────────────────────

class MockQueryBuilder {
  private tableName: string;
  private storageKey: string;
  private filters: QueryFilter[] = [];
  private orderColumn: string | null = null;
  private orderAscending = true;
  private limitCount: number | null = null;
  private selectColumns: string = '*';
  private isSingle = false;

  constructor(tableName: string) {
    this.tableName = tableName;
    this.storageKey = TABLE_KEYS[tableName] ?? `@mock:${tableName}`;
  }

  select(columns: string = '*') {
    this.selectColumns = columns;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, op: 'eq', value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ column, op: 'neq', value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ column, op: 'in', value: values });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderColumn = column;
    this.orderAscending = options?.ascending ?? true;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isSingle = true;
    return this;
  }

  async then(resolve: (result: { data: unknown; error: unknown; count?: number }) => void) {
    const result = await this.execute();
    resolve(result);
  }

  private async execute() {
    await initializeMockData();
    let items = await getCollection<Record<string, unknown>>(this.storageKey);
    items = applyFilters(items, this.filters);

    if (this.orderColumn) {
      const col = this.orderColumn;
      const asc = this.orderAscending;
      items.sort((a, b) => {
        const aVal = a[col];
        const bVal = b[col];
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return asc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return asc
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      });
    }

    if (this.limitCount !== null) {
      items = items.slice(0, this.limitCount);
    }

    if (this.isSingle) {
      return { data: items[0] ?? null, error: null };
    }

    return { data: items, error: null, count: items.length };
  }

  // Insert
  async insert(data: Record<string, unknown> | Record<string, unknown>[]) {
    await initializeMockData();
    const items = await getCollection<Record<string, unknown>>(this.storageKey);
    const toInsert = Array.isArray(data) ? data : [data];
    const newItems = toInsert.map((item) => ({
      id: generateUUID(),
      created_at: new Date().toISOString(),
      ...item,
    }));
    items.push(...newItems);
    await setCollection(this.storageKey, items);
    return {
      data: newItems.length === 1 ? newItems[0] : newItems,
      error: null,
      select: () => ({
        single: async () => ({ data: newItems[0], error: null }),
        then: async (resolve: (r: { data: unknown; error: unknown }) => void) =>
          resolve({ data: newItems, error: null }),
      }),
    };
  }

  // Update
  async update(updates: Record<string, unknown>) {
    await initializeMockData();
    const items = await getCollection<Record<string, unknown>>(this.storageKey);
    const filtered = applyFilters(items, this.filters);
    const updatedIds = new Set(filtered.map((item) => item.id));

    const newItems = items.map((item) => {
      if (updatedIds.has(item.id)) {
        return { ...item, ...updates };
      }
      return item;
    });

    await setCollection(this.storageKey, newItems);
    return { data: filtered.map((item) => ({ ...item, ...updates })), error: null };
  }

  // Upsert
  async upsert(
    data: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string }
  ) {
    await initializeMockData();
    const items = await getCollection<Record<string, unknown>>(this.storageKey);
    const toUpsert = Array.isArray(data) ? data : [data];
    const onConflictKey = options?.onConflict;

    for (const record of toUpsert) {
      let idx = -1;
      if (onConflictKey && record[onConflictKey] !== undefined) {
        idx = items.findIndex((item) => item[onConflictKey] === record[onConflictKey]);
      } else if (record.id !== undefined) {
        idx = items.findIndex((item) => item.id === record.id);
      }

      if (idx >= 0) {
        items[idx] = { ...items[idx], ...record };
      } else {
        items.push({
          id: (record.id as string) ?? generateUUID(),
          created_at: new Date().toISOString(),
          ...record,
        });
      }
    }

    await setCollection(this.storageKey, items);
    return { data: toUpsert, error: null };
  }

  // Delete
  async delete() {
    await initializeMockData();
    const items = await getCollection<Record<string, unknown>>(this.storageKey);
    const filtered = applyFilters(items, this.filters);
    const deleteIds = new Set(filtered.map((item) => item.id));
    const remaining = items.filter((item) => !deleteIds.has(item.id));
    await setCollection(this.storageKey, remaining);
    return { data: filtered, error: null };
  }
}

// ─── Mock Supabase Client ────────────────────────────────────────────────────

export const mockSupabase = {
  auth: mockAuth,
  from(table: string) {
    return new MockQueryBuilder(table);
  },
};

// ─── Simulator Actions (Mock Mode Only) ──────────────────────────────────────

export async function simulatorSetDeviceStatus(
  deviceId: string,
  status: 'online' | 'offline'
): Promise<void> {
  const devices = await getCollection<Device>(KEYS.DEVICES);
  const updated = devices.map((d) =>
    d.id === deviceId
      ? { ...d, status, last_seen: status === 'online' ? new Date().toISOString() : d.last_seen }
      : d
  );
  await setCollection(KEYS.DEVICES, updated);
}

export async function simulatorToggleWater(
  deviceId: string,
  available: boolean
): Promise<void> {
  const events = await getCollection<WaterEvent>(KEYS.WATER_EVENTS);
  const newEvent: WaterEvent = {
    id: generateUUID(),
    device_id: deviceId,
    water_level: available ? 3 : 0,
    sensor_value: available ? 850 : 120,
    uptime_sec: Math.floor(Date.now() / 1000) % 100000,
    event_type: available ? 'arrived' : 'stopped',
    detected_at: new Date().toISOString(),
  };
  events.unshift(newEvent);
  await setCollection(KEYS.WATER_EVENTS, events);
}

export async function resetMockData(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
  await initializeMockData();
}
