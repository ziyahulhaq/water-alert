import { useEffect, useState } from 'react';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useToast } from '../hooks/useToast';
import { listDevices, updateDeviceStatus, removeDevice } from '../services/adminDevices';
import { supabase } from '../../lib/supabase';
import { ToastContainer, Badge, Table, Td, ConfirmDialog } from '../components/ui';
import type { AdminDevice } from '../types/admin';
import { Wifi, WifiOff, Trash2, RefreshCw, Cpu, Sliders, X, Save, AlertCircle, MessageSquare, Check, XCircle } from 'lucide-react';

// ─── Threshold Request type ──────────────────────────────────
interface ThresholdRequest {
  id: string;
  device_id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

// ─── Threshold types ─────────────────────────────────────────
interface DeviceThresholds {
  threshold_no_water_max: number;
  threshold_low_max: number;
  threshold_medium_max: number;
  alert_threshold: number;
  reset_threshold: number;
}

const DEFAULT_THRESH: DeviceThresholds = {
  threshold_no_water_max: 150,
  threshold_low_max: 600,
  threshold_medium_max: 1200,
  alert_threshold: 601,
  reset_threshold: 150,
};

// ─── Threshold Editor Modal ──────────────────────────────────
function ThresholdModal({
  device,
  onClose,
  onSaved,
}: {
  device: AdminDevice;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [thresh, setThresh] = useState<DeviceThresholds>(DEFAULT_THRESH);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  // Load current thresholds
  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase
        .from('devices')
        .select('threshold_no_water_max, threshold_low_max, threshold_medium_max, alert_threshold, reset_threshold')
        .eq('id', device.id)
        .single();
      if (err) { setError(err.message); setLoading(false); return; }
      if (data) {
        setThresh({
          threshold_no_water_max: data.threshold_no_water_max ?? 150,
          threshold_low_max: data.threshold_low_max ?? 600,
          threshold_medium_max: data.threshold_medium_max ?? 1200,
          alert_threshold: data.alert_threshold ?? 601,
          reset_threshold: data.reset_threshold ?? 150,
        });
      }
      setLoading(false);
    })();
  }, [device.id]);

  const setField = (key: keyof DeviceThresholds, val: number) => {
    setThresh(prev => {
      const next = { ...prev, [key]: val };

      if (key === 'threshold_no_water_max') {
        if (next.threshold_low_max <= next.threshold_no_water_max)
          next.threshold_low_max = next.threshold_no_water_max + 1;
        if (next.threshold_medium_max <= next.threshold_low_max)
          next.threshold_medium_max = next.threshold_low_max + 1;
        if (next.alert_threshold <= next.threshold_low_max)
          next.alert_threshold = next.threshold_low_max + 1;
        if (next.reset_threshold > next.threshold_no_water_max)
          next.reset_threshold = next.threshold_no_water_max;
      }
      if (key === 'threshold_low_max') {
        if (next.threshold_no_water_max >= next.threshold_low_max)
          next.threshold_no_water_max = next.threshold_low_max - 1;
        if (next.threshold_medium_max <= next.threshold_low_max)
          next.threshold_medium_max = next.threshold_low_max + 1;
        if (next.alert_threshold <= next.threshold_low_max)
          next.alert_threshold = next.threshold_low_max + 1;
      }
      if (key === 'threshold_medium_max') {
        if (next.threshold_low_max >= next.threshold_medium_max)
          next.threshold_low_max = next.threshold_medium_max - 1;
        if (next.alert_threshold <= next.threshold_low_max)
          next.alert_threshold = next.threshold_low_max + 1;
      }
      if (key === 'alert_threshold') {
        if (next.alert_threshold <= next.threshold_low_max)
          next.alert_threshold = next.threshold_low_max + 1;
      }
      if (key === 'reset_threshold') {
        if (next.reset_threshold > next.threshold_no_water_max)
          next.reset_threshold = next.threshold_no_water_max;
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const { error: err } = await supabase
        .from('devices')
        .update(thresh)
        .eq('id', device.id);
      if (err) throw err;
      onSaved();
      onClose();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const threshFields = [
    { key: 'threshold_no_water_max' as const, label: '🪣 No Water (Dry)', badge: 'DRY', color: 'slate', hint: 'ADC ≤ this → Pipe dry', min: 0, max: 800 },
    { key: 'threshold_low_max' as const, label: '💧 Low Water', badge: 'LOW', color: 'blue', hint: 'ADC ≤ this → Low water', min: 50, max: 1500 },
    { key: 'threshold_medium_max' as const, label: '🌊 Medium Water', badge: 'MEDIUM', color: 'cyan', hint: 'ADC ≤ this → Medium water', min: 100, max: 3000 },
    { key: 'alert_threshold' as const, label: '🚰 Send Alert From', badge: 'ALERT', color: 'emerald', hint: `Must be > Low Water (${thresh.threshold_low_max})`, min: thresh.threshold_low_max + 1, max: 3000 },
    { key: 'reset_threshold' as const, label: '🔄 Water Stopped (Reset)', badge: 'RESET', color: 'rose', hint: 'ADC ≤ this → Reset alert', min: 0, max: 500 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 sticky top-0 bg-slate-900 z-10">
          <div>
            <h3 className="font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" /> Water Level Thresholds
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Device: <span className="text-indigo-400 font-mono">{device.model_id ?? device.mac_hash?.slice(0, 12)}</span>
              {device.user_name && <span> · Owner: {device.user_name}</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {loading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-slate-800/40 animate-pulse" />)}
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {error && (
              <div className="flex items-start gap-2 bg-red-950/50 border border-red-500/30 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Info banner */}
            <div className="flex items-start gap-2 bg-cyan-500/8 border border-cyan-500/20 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
              <p className="text-xs text-cyan-300/80 leading-relaxed">
                After saving, the user must <strong className="text-cyan-300">turn the device OFF and ON</strong> to apply the new thresholds.
              </p>
            </div>

            {/* Threshold inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {threshFields.map(({ key, label, badge, hint, min, max }) => (
                <div key={key} className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <span className="text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full border bg-slate-500/10 border-slate-500/30 text-slate-400">
                      {badge}
                    </span>
                  </div>

                  <input
                    type="range"
                    min={min} max={max}
                    value={thresh[key]}
                    onChange={e => setField(key, Number(e.target.value))}
                    className="w-full h-1.5 rounded-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-600">
                    <span>{min}</span>
                    <span className="text-slate-500 text-center truncate px-1">{hint}</span>
                    <span>{max}</span>
                  </div>

                  <input
                    type="number"
                    min={min} max={max}
                    value={thresh[key]}
                    onChange={e => setField(key, Math.min(max, Math.max(min, Number(e.target.value))))}
                    className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-500/50 transition-colors"
                  />
                </div>
              ))}
            </div>

            {/* Level order guide */}
            <div className="bg-slate-950/60 border border-slate-800/40 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-3 font-semibold uppercase tracking-wider">Current Level Order</p>
              <div className="flex items-center gap-1 text-[11px] flex-wrap">
                <span className="bg-slate-800 text-slate-400 px-2 py-1 rounded-lg font-mono">{thresh.threshold_no_water_max}</span>
                <span className="text-slate-600">→ Dry</span>
                <span className="text-slate-700 mx-1">|</span>
                <span className="bg-blue-900/30 text-blue-400 px-2 py-1 rounded-lg font-mono">{thresh.threshold_low_max}</span>
                <span className="text-slate-600">→ Low</span>
                <span className="text-slate-700 mx-1">|</span>
                <span className="bg-cyan-900/30 text-cyan-400 px-2 py-1 rounded-lg font-mono">{thresh.threshold_medium_max}</span>
                <span className="text-slate-600">→ Medium</span>
                <span className="text-slate-700 mx-1">|</span>
                <span className="bg-emerald-900/30 text-emerald-400 px-2 py-1 rounded-lg font-mono">{thresh.alert_threshold}+</span>
                <span className="text-slate-600">→ 🚨 Alert!</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
              >
                {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save Thresholds'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Devices Page ───────────────────────────────────────
export default function AdminDevices() {
  const { profile } = useAdminAuth();
  const { toasts, showToast, dismissToast } = useToast();
  const [devices, setDevices] = useState<AdminDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<{ open: boolean; device?: AdminDevice }>({ open: false });
  const [threshDevice, setThreshDevice] = useState<AdminDevice | null>(null);
  const [requests, setRequests] = useState<ThresholdRequest[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      setDevices(await listDevices());
      // Load pending threshold requests
      const { data: reqs } = await supabase
        .from('threshold_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setRequests((reqs ?? []) as ThresholdRequest[]);
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleResolveRequest = async (reqId: string, status: 'approved' | 'rejected') => {
    try {
      const { error: err } = await supabase
        .from('threshold_requests')
        .update({ status, resolved_at: new Date().toISOString() })
        .eq('id', reqId);
      if (err) throw err;
      showToast(`Request ${status}`, 'success');
      await load();
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  const handleToggle = async (device: AdminDevice) => {
    if (!profile) return;
    const newStatus = device.status === 'online' ? 'offline' : 'online';
    try {
      await updateDeviceStatus(device.id, newStatus, profile.id, profile.email);
      showToast(`Device set ${newStatus}`, 'success');
      await load();
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  const handleRemove = async () => {
    if (!confirm.device || !profile) return;
    try {
      await removeDevice(confirm.device.id, profile.id, profile.email);
      showToast('Device removed', 'success');
      await load();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setConfirm({ open: false }); }
  };

  const fmt = (d: string | null) => d ? new Date(d).toLocaleString() : '—';

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-6 h-6 text-purple-400" /> Device Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">{devices.length} devices registered</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 border border-slate-700 rounded-xl text-slate-400 hover:text-white text-sm transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total',   value: devices.length,                              color: 'bg-slate-800' },
          { label: 'Online',  value: devices.filter(d => d.status === 'online').length,  color: 'bg-emerald-900/30 border-emerald-500/20' },
          { label: 'Offline', value: devices.filter(d => d.status === 'offline').length, color: 'bg-rose-900/30 border-rose-500/20' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border border-slate-800/60 p-4 text-center ${s.color}`}>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-slate-800/40 animate-pulse" />)}</div>
      ) : (
        <Table headers={['Device', 'User', 'Status', 'Last Seen', 'Actions']}>
          {devices.map(d => (
            <tr key={d.id} className="hover:bg-slate-800/20 transition-colors">
              <Td>
                <div>
                  <span className="font-mono text-xs text-indigo-300">{d.model_id ?? '—'}</span>
                  <p className="text-[10px] text-slate-600 truncate max-w-[140px]">{d.mac_hash?.slice(0, 16)}…</p>
                </div>
              </Td>
              <Td>
                <div>
                  <p className="text-white text-sm">{d.user_name ?? '—'}</p>
                  <p className="text-xs text-slate-500">{d.user_email ?? 'Unassigned'}</p>
                </div>
              </Td>
              <Td><Badge value={d.status} /></Td>
              <Td><span className="text-xs text-slate-500">{fmt(d.last_seen)}</span></Td>
              <Td>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setThreshDevice(d)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-cyan-900/20 transition-colors"
                    title="Edit Thresholds"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleToggle(d)}
                    className={`p-1.5 rounded-lg transition-colors ${d.status === 'online' ? 'text-slate-500 hover:text-amber-400 hover:bg-amber-900/20' : 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-900/20'}`}
                    title={d.status === 'online' ? 'Set Offline' : 'Set Online'}
                  >
                    {d.status === 'online' ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => setConfirm({ open: true, device: d })}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                    title="Remove Device"
                  ><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </Td>
            </tr>
          ))}
          {devices.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-600 text-sm">No devices registered</td></tr>}
        </Table>
      )}

      {/* ── Threshold Requests from Users ── */}
      {requests.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800/40 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            <h2 className="font-semibold text-white">Threshold Adjustment Requests</h2>
            <span className="ml-auto bg-cyan-500/15 text-cyan-300 text-xs font-bold px-2 py-0.5 rounded-full">
              {requests.filter(r => r.status === 'pending').length} pending
            </span>
          </div>
          <div className="divide-y divide-slate-800/40 max-h-96 overflow-y-auto">
            {requests.map(req => {
              const isPending = req.status === 'pending';
              const reqDevice = devices.find(d => d.id === req.device_id);
              return (
                <div key={req.id} className={`px-5 py-4 ${isPending ? 'bg-cyan-950/10' : 'opacity-60'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white">{req.user_name || req.user_email || 'Unknown'}</span>
                        <span className="text-[10px] text-slate-500">{req.user_email}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                          req.status === 'pending' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          : req.status === 'approved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-red-500/10 border-red-500/30 text-red-400'
                        }`}>{req.status.toUpperCase()}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">"{req.message}"</p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-600">
                        <span>Device: <span className="text-indigo-400 font-mono">{reqDevice?.model_id ?? req.device_id.slice(0, 8)}</span></span>
                        <span>{new Date(req.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    {isPending && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            if (reqDevice) setThreshDevice(reqDevice);
                            handleResolveRequest(req.id, 'approved');
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 text-xs font-medium transition-colors"
                          title="Approve & Edit Thresholds"
                        >
                          <Check className="w-3 h-3" /> Adjust
                        </button>
                        <button
                          onClick={() => handleResolveRequest(req.id, 'rejected')}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                          title="Reject"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Threshold Editor Modal */}
      {threshDevice && (
        <ThresholdModal
          device={threshDevice}
          onClose={() => setThreshDevice(null)}
          onSaved={() => { showToast('Thresholds saved — device must restart to apply', 'success'); load(); }}
        />
      )}

      <ConfirmDialog
        open={confirm.open}
        title="Remove Device"
        message={`Remove device ${confirm.device?.model_id ?? confirm.device?.mac_hash?.slice(0, 12)}? The device will need to be re-paired.`}
        confirmLabel="Remove Device"
        onConfirm={handleRemove}
        onCancel={() => setConfirm({ open: false })}
      />
    </div>
  );
}
