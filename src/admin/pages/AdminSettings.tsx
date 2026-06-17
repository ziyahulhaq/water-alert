import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ui';
import type { AppSetting } from '../types/admin';
import { Settings, Save, ToggleLeft, ToggleRight, Key, MessageSquare, Globe } from 'lucide-react';

export default function AdminSettings() {
  const { toasts, showToast, dismissToast } = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('app_settings').select('*');
    if (data) {
      const map: Record<string, string> = {};
      (data as AppSetting[]).forEach(s => { map[s.key] = s.value; });
      setSettings(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const set = (key: string, value: string) => setSettings(prev => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const rows = Object.entries(settings).map(([key, value]) => ({ key, value }));
      const { error } = await supabase.from('app_settings').upsert(rows, { onConflict: 'key' });
      if (error) throw error;
      showToast('Settings saved', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const Toggle = ({ keyName }: { keyName: string }) => {
    const on = settings[keyName] === 'true';
    return (
      <button onClick={() => set(keyName, on ? 'false' : 'true')} className={`transition-colors ${on ? 'text-indigo-400' : 'text-slate-600'}`}>
        {on ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
      </button>
    );
  };

  if (loading) return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-slate-800/40 animate-pulse" />)}
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-slate-400" /> Settings
        </h1>
        <p className="text-slate-500 text-sm mt-1">Manage app configuration and notification settings</p>
      </div>

      {/* App Settings */}
      <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-800/40">
          <Globe className="w-4 h-4 text-blue-400" />
          <h2 className="font-semibold text-white">Application</h2>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">App Name</label>
            <input
              value={settings['app_name'] ?? ''}
              onChange={e => set('app_name', e.target.value)}
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-colors"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700/40">
            <div>
              <p className="text-sm font-semibold text-white">Maintenance Mode</p>
              <p className="text-xs text-slate-500 mt-0.5">Show maintenance banner to all users</p>
            </div>
            <Toggle keyName="maintenance_mode" />
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700/40">
            <div>
              <p className="text-sm font-semibold text-white">WhatsApp Notifications</p>
              <p className="text-xs text-slate-500 mt-0.5">Enable WhatsApp alert delivery</p>
            </div>
            <Toggle keyName="whatsapp_enabled" />
          </div>
        </div>
      </div>

      {/* VAPID Keys */}
      <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-800/40">
          <Key className="w-4 h-4 text-amber-400" />
          <h2 className="font-semibold text-white">Push Notification Keys</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">VAPID Public Key</label>
            <div className="w-full bg-slate-800/30 border border-slate-700/40 rounded-xl px-4 py-2.5 text-xs text-slate-500 font-mono break-all">
              {import.meta.env.VITE_VAPID_PUBLIC_KEY || '(not configured)'}
            </div>
          </div>
          <p className="text-xs text-slate-600">VAPID keys are configured via environment variables. Contact your deployment admin to update them.</p>
        </div>
      </div>

      {/* WhatsApp Config */}
      <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-800/40">
          <MessageSquare className="w-4 h-4 text-emerald-400" />
          <h2 className="font-semibold text-white">WhatsApp Configuration</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">API Endpoint</label>
            <input
              value={settings['whatsapp_api'] ?? ''}
              onChange={e => set('whatsapp_api', e.target.value)}
              placeholder="https://api.whatsapp.example.com/send"
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">API Key</label>
            <input
              type="password"
              value={settings['whatsapp_api_key'] ?? ''}
              onChange={e => set('whatsapp_api_key', e.target.value)}
              placeholder="••••••••••••••••"
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition-colors"
        >
          {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
