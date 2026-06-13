import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if variables are valid and not placeholders
const isRealSupabase = 
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'YOUR_SUPABASE_URL' && 
  supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY' &&
  !supabaseUrl.includes('placeholder') &&
  !supabaseAnonKey.includes('placeholder');

class MockSupabaseClient {
  private getStorage<T>(key: string, defaultValue: T): T {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  }

  private setStorage<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // Auth implementation
  auth = {
    signUp: async (credentials: any) => {
      const { email } = credentials;
      await new Promise(resolve => setTimeout(resolve, 500));
      const users = this.getStorage<any[]>('mock_users_db', []);
      if (users.find(u => u.email === email)) {
        return { data: { user: null }, error: { message: 'User already exists' } };
      }
      const newUser = { id: crypto.randomUUID(), email, created_at: new Date().toISOString() };
      users.push(newUser);
      this.setStorage('mock_users_db', users);
      
      // Auto-profile and default notifications settings (replicates SQL trigger)
      const settings = this.getStorage<any[]>('mock_notification_settings', []);
      settings.push({
        id: crypto.randomUUID(),
        user_id: newUser.id,
        whatsapp_number: '',
        enabled: false
      });
      this.setStorage('mock_notification_settings', settings);

      const profiles = this.getStorage<any[]>('mock_profiles', []);
      profiles.push({
        id: newUser.id,
        email: newUser.email,
        link_token: crypto.randomUUID(),
        chat_id: null,
        created_at: newUser.created_at
      });
      this.setStorage('mock_profiles', profiles);

      this.setStorage('mock_session_user', newUser);
      this.triggerAuthChange('SIGNED_IN', newUser);
      return { data: { user: newUser, session: { user: newUser } }, error: null };
    },

    signInWithPassword: async (credentials: any) => {
      const { email } = credentials;
      await new Promise(resolve => setTimeout(resolve, 500));
      const users = this.getStorage<any[]>('mock_users_db', []);
      const user = users.find(u => u.email === email);
      if (!user) {
        return { data: { user: null }, error: { message: 'Invalid login credentials' } };
      }
      this.setStorage('mock_session_user', user);
      this.triggerAuthChange('SIGNED_IN', user);
      return { data: { user, session: { user } }, error: null };
    },

    signOut: async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
      this.setStorage('mock_session_user', null);
      this.triggerAuthChange('SIGNED_OUT', null);
      return { error: null };
    },

    getUser: async () => {
      const user = this.getStorage<any>('mock_session_user', null);
      return { data: { user }, error: null };
    },

    getSession: async () => {
      const user = this.getStorage<any>('mock_session_user', null);
      return { data: { session: user ? { user } : null }, error: null };
    },

    onAuthStateChange: (callback: any) => {
      this.authListeners.push(callback);
      // Immediately call with current state
      const user = this.getStorage<any>('mock_session_user', null);
      callback(user ? 'SIGNED_IN' : 'SIGNED_OUT', user ? { user } : null);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              this.authListeners = this.authListeners.filter(l => l !== callback);
            }
          }
        }
      };
    }
  };

  private authListeners: any[] = [];
  private triggerAuthChange(event: string, user: any) {
    this.authListeners.forEach(listener => listener(event, user ? { user } : null));
  }

  // Database implementation
  from(table: string) {
    const client = this;
    
    const makeQueryBuilder = (filterFn?: (items: any[]) => any[]) => {
      const runQuery = () => {
        let data = client.getStorage<any[]>(`mock_${table}`, []);
        if (filterFn) data = filterFn(data);
        return { data, error: null };
      };

      const builder: any = {
        eq(column: string, value: any) {
          const newFilter = (items: any[]) => {
            const current = filterFn ? filterFn(items) : items;
            return current.filter(item => item[column] === value);
          };
          return makeQueryBuilder(newFilter);
        },
        order(column: string, { ascending = false } = {}) {
          const newFilter = (items: any[]) => {
            const current = filterFn ? filterFn(items) : items;
            return [...current].sort((a, b) => {
              const valA = a[column];
              const valB = b[column];
              if (valA < valB) return ascending ? -1 : 1;
              if (valA > valB) return ascending ? 1 : -1;
              return 0;
            });
          };
          return makeQueryBuilder(newFilter);
        },
        limit(count: number) {
          const newFilter = (items: any[]) => {
            const current = filterFn ? filterFn(items) : items;
            return current.slice(0, count);
          };
          return makeQueryBuilder(newFilter);
        },
        single() {
          const res = runQuery();
          const item = res.data[0];
          if (!item) {
            return Promise.resolve({ data: null, error: { message: 'Row not found', code: 'PGRST116' } });
          }
          return Promise.resolve({ data: item, error: null });
        },
        then(onfulfilled: any) {
          return Promise.resolve(runQuery()).then(onfulfilled);
        }
      };
      return builder;
    };

    return {
      select() {
        return makeQueryBuilder();
      },

      insert(data: any) {
        const items = client.getStorage<any[]>(`mock_${table}`, []);
        const newItems = Array.isArray(data) ? data : [data];
        const inserted = newItems.map(item => ({
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          ...item
        }));
        items.push(...inserted);
        client.setStorage(`mock_${table}`, items);

        return {
          select() {
            return {
              single() {
                return Promise.resolve({ data: inserted[0] || null, error: null });
              },
              then(resolve: any) {
                resolve({ data: inserted, error: null });
              }
            };
          },
          then(resolve: any) {
            resolve({ data: inserted, error: null });
          }
        };
      },

      update(data: any) {
        return {
          eq(column: string, value: any) {
            const items = client.getStorage<any[]>(`mock_${table}`, []);
            const newItems = items.map(item => {
              if (item[column] === value) {
                return { ...item, ...data };
              }
              return item;
            });
            client.setStorage(`mock_${table}`, newItems);
            const updated = newItems.filter(item => item[column] === value);
            
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({ data: updated[0] || null, error: null });
                  },
                  then(resolve: any) {
                    resolve({ data: updated, error: null });
                  }
                };
              },
              then(resolve: any) {
                resolve({ data: updated, error: null });
              }
            };
          }
        };
      },

      upsert(data: any) {
        const items = client.getStorage<any[]>(`mock_${table}`, []);
        const upsertItems = Array.isArray(data) ? data : [data];
        // devices table upsert on conflict mac_id
        // notification_settings table upsert on conflict user_id
        // profiles table upsert on conflict id
        const key = table === 'devices' ? 'mac_id' : (table === 'notification_settings' ? 'user_id' : 'id');

        const insertedOrUpdated: any[] = [];
        upsertItems.forEach(uItem => {
          const index = items.findIndex(item => item[key] === uItem[key]);
          if (index !== -1) {
            items[index] = { ...items[index], ...uItem };
            insertedOrUpdated.push(items[index]);
          } else {
            const newItem = {
              id: crypto.randomUUID(),
              created_at: new Date().toISOString(),
              ...uItem
            };
            items.push(newItem);
            insertedOrUpdated.push(newItem);
          }
        });

        client.setStorage(`mock_${table}`, items);

        return {
          select() {
            return {
              single() {
                return Promise.resolve({ data: insertedOrUpdated[0] || null, error: null });
              },
              then(resolve: any) {
                resolve({ data: insertedOrUpdated, error: null });
              }
            };
          },
          then(resolve: any) {
            resolve({ data: insertedOrUpdated, error: null });
          }
        };
      }
    };
  }
}

export const supabase = isRealSupabase
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (new MockSupabaseClient() as any);

export const isDemoMode = !isRealSupabase;
