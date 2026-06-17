import { useEffect, useState } from 'react';
import { useToast } from '../hooks/useToast';
import { listEvents, exportEventsCSV } from '../services/adminEvents';
import { ToastContainer, Badge, Table, Td } from '../components/ui';
import type { WaterEvent } from '../types/admin';
import { Download, Search, RefreshCw, Activity } from 'lucide-react';

export default function AdminEvents() {
  const { toasts, showToast, dismissToast } = useToast();
  const [events, setEvents]     = useState<WaterEvent[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setEvents(await listEvents({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }));
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = events.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.device_mac?.toLowerCase().includes(q) ||
      e.device_id.toLowerCase().includes(q) ||
      String(e.water_level).toLowerCase().includes(q)
    );
  });

  const getLevelLabel = (level: any) => {
    if (level === 1 || level === '1') return 'HIGH';
    if (level === 0 || level === '0') return 'LOW';
    return String(level).toUpperCase();
  };

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-cyan-400" /> Water Events
          </h1>
          <p className="text-slate-500 text-sm mt-1">{filtered.length} events shown</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportEventsCSV(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-700 rounded-xl text-slate-400 hover:text-white text-sm transition-colors disabled:opacity-40"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={load} disabled={loading} className="p-2.5 border border-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by device or level..."
            className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2.5 text-sm text-slate-400 focus:outline-none focus:border-indigo-500/60 transition-colors" />
          <span className="text-slate-600 text-xs">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2.5 text-sm text-slate-400 focus:outline-none focus:border-indigo-500/60 transition-colors" />
          <button onClick={load} className="px-4 py-2.5 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 rounded-xl text-sm hover:bg-indigo-600/30 transition-colors">Filter</button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-slate-800/40 animate-pulse" />)}</div>
      ) : (
        <Table headers={['#', 'Device', 'Water Level', 'Detected At']}>
          {filtered.map((e, i) => (
            <tr key={e.id} className="hover:bg-slate-800/20 transition-colors">
              <Td><span className="text-slate-600 text-xs">{i + 1}</span></Td>
              <Td><span className="font-mono text-xs text-indigo-300">{e.device_mac ?? e.device_id.slice(0, 12) + '…'}</span></Td>
              <Td><Badge value={getLevelLabel(e.water_level)} /></Td>
              <Td><span className="text-xs text-slate-500">{new Date(e.detected_at).toLocaleString()}</span></Td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-600 text-sm">No events found</td></tr>}
        </Table>
      )}
    </div>
  );
}
