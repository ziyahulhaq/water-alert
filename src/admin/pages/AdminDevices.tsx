import { useEffect, useState } from 'react';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useToast } from '../hooks/useToast';
import { listDevices, updateDeviceStatus, removeDevice } from '../services/adminDevices';
import { ToastContainer, Badge, Table, Td, ConfirmDialog } from '../components/ui';
import type { AdminDevice } from '../types/admin';
import { Wifi, WifiOff, Trash2, RefreshCw, Cpu } from 'lucide-react';

export default function AdminDevices() {
  const { profile } = useAdminAuth();
  const { toasts, showToast, dismissToast } = useToast();
  const [devices, setDevices] = useState<AdminDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<{ open: boolean; device?: AdminDevice; action?: 'remove' }>({ open: false });

  const load = async () => {
    setLoading(true);
    try { setDevices(await listDevices()); } catch (e: any) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

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
        <Table headers={['MAC ID', 'User', 'Status', 'Last Seen', 'Actions']}>
          {devices.map(d => (
            <tr key={d.id} className="hover:bg-slate-800/20 transition-colors">
              <Td><span className="font-mono text-xs text-indigo-300">{d.mac_id}</span></Td>
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
                    onClick={() => handleToggle(d)}
                    className={`p-1.5 rounded-lg transition-colors ${d.status === 'online' ? 'text-slate-500 hover:text-amber-400 hover:bg-amber-900/20' : 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-900/20'}`}
                    title={d.status === 'online' ? 'Set Offline' : 'Set Online'}
                  >
                    {d.status === 'online' ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => setConfirm({ open: true, device: d, action: 'remove' })}
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

      <ConfirmDialog
        open={confirm.open}
        title="Remove Device"
        message={`Remove device ${confirm.device?.mac_id}? The device will need to be re-paired.`}
        confirmLabel="Remove Device"
        onConfirm={handleRemove}
        onCancel={() => setConfirm({ open: false })}
      />
    </div>
  );
}
