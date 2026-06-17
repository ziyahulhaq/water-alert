import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboardStats } from '../services/adminStats';
import { supabase } from '../../lib/supabase';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { StatCard, Badge, Table, Td } from '../components/ui';
import type { DashboardStats, AdminUser, AdminDevice, WaterEvent, AuditLog } from '../types/admin';
import {
  Users, Cpu, Wifi, WifiOff, Activity,
  Droplet, Bell, RefreshCw, ArrowRight, ShieldCheck,
} from 'lucide-react';

export default function AdminDashboard() {
  const { profile } = useAdminAuth();
  const [stats, setStats]     = useState<DashboardStats | null>(null);
  const [users, setUsers]     = useState<AdminUser[]>([]);
  const [devices, setDevices] = useState<AdminDevice[]>([]);
  const [events, setEvents]   = useState<WaterEvent[]>([]);
  const [logs, setLogs]       = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [statsData, usersData, devicesData, eventsData, logsData] = await Promise.all([
        getDashboardStats(),
        supabase.from('profiles').select('id,name,email,role,status,created_at').order('created_at', { ascending: false }).limit(5).then(r => r.data ?? []),
        supabase.from('devices').select('id,mac_hash,model_id,status,last_seen').order('last_seen', { ascending: false, nullsFirst: false }).limit(5).then(r => r.data ?? []),
        supabase.from('water_events').select('id,device_id,detected_at,water_level').order('detected_at', { ascending: false }).limit(10).then(r => r.data ?? []),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(8).then(r => r.data ?? []),
      ]);
      setStats(statsData);
      setUsers(usersData as AdminUser[]);
      setDevices(devicesData as AdminDevice[]);
      setEvents(eventsData as WaterEvent[]);
      setLogs(logsData as AuditLog[]);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const fmt = (d: string) => new Date(d).toLocaleString();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-400" />
            Admin Dashboard
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Welcome back, <span className="text-indigo-400 font-medium">{profile?.name ?? profile?.email}</span>
            {' · '}Last updated {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700/60 text-slate-400 hover:text-white hover:border-slate-600 text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      {loading && !stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-800/40 animate-pulse border border-slate-800/60" />
          ))}
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Users"        value={stats.totalUsers}        icon={Users}   color="blue"    />
          <StatCard label="Total Admins"       value={stats.totalAdmins}       icon={ShieldCheck} color="indigo" />
          <StatCard label="Total Devices"      value={stats.totalDevices}      icon={Cpu}     color="purple"  />
          <StatCard label="Online Devices"     value={stats.onlineDevices}     icon={Wifi}    color="emerald" />
          <StatCard label="Offline Devices"    value={stats.offlineDevices}    icon={WifiOff} color="rose"    />
          <StatCard label="Events Today"       value={stats.waterEventsToday}  icon={Droplet} color="amber"   />
          <StatCard label="Active Alerts"      value={stats.activeAlerts}      icon={Bell}    color="amber"   />
        </div>
      )}

      {/* Recent tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/40">
            <h2 className="font-semibold text-white flex items-center gap-2"><Users className="w-4 h-4 text-blue-400" /> Recent Users</h2>
            <Link to="/admin/users" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <Table headers={['Name', 'Role', 'Status']}>
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-800/20 transition-colors">
                <Td>
                  <div>
                    <p className="font-medium text-white text-sm">{u.name ?? '—'}</p>
                    <p className="text-xs text-slate-500 truncate max-w-[160px]">{u.email}</p>
                  </div>
                </Td>
                <Td><Badge value={u.role} /></Td>
                <Td><Badge value={u.status} /></Td>
              </tr>
            ))}
          </Table>
        </div>

        {/* Recent Devices */}
        <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/40">
            <h2 className="font-semibold text-white flex items-center gap-2"><Cpu className="w-4 h-4 text-purple-400" /> Recent Devices</h2>
            <Link to="/admin/devices" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <Table headers={['Device', 'Status', 'Last Seen']}>
            {devices.map(d => (
              <tr key={d.id} className="hover:bg-slate-800/20 transition-colors">
                <Td>
                  <div>
                    <span className="font-mono text-xs text-indigo-300">{(d as any).model_id ?? '—'}</span>
                    <p className="text-[10px] text-slate-600 truncate max-w-[120px]">{(d as any).mac_hash?.slice(0, 12)}…</p>
                  </div>
                </Td>
                <Td><Badge value={d.status} /></Td>
                <Td><span className="text-xs text-slate-500">{d.last_seen ? fmt(d.last_seen) : '—'}</span></Td>
              </tr>
            ))}
          </Table>
        </div>
      </div>

      {/* Recent Events + Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Water Events */}
        <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/40">
            <h2 className="font-semibold text-white flex items-center gap-2"><Activity className="w-4 h-4 text-cyan-400" /> Recent Water Events</h2>
            <Link to="/admin/events" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <Table headers={['Device', 'Level', 'Time']}>
            {events.map(e => (
              <tr key={e.id} className="hover:bg-slate-800/20 transition-colors">
                <Td><span className="font-mono text-xs">{e.device_id.slice(0, 8)}…</span></Td>
                <Td><Badge value={String(e.water_level).toUpperCase()} /></Td>
                <Td><span className="text-xs text-slate-500">{fmt(e.detected_at)}</span></Td>
              </tr>
            ))}
          </Table>
        </div>

        {/* Audit Logs */}
        <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800/40">
            <h2 className="font-semibold text-white flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-indigo-400" /> Audit Log</h2>
          </div>
          <div className="divide-y divide-slate-800/40 max-h-64 overflow-y-auto">
            {logs.map(log => (
              <div key={log.id} className="px-5 py-3 flex items-start gap-3 hover:bg-slate-800/20 transition-colors">
                <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium">{log.action.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-slate-500 truncate">by {log.actor_email ?? 'system'}</p>
                </div>
                <span className="text-[10px] text-slate-600 shrink-0 ml-auto">
                  {new Date(log.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
            {logs.length === 0 && <p className="px-5 py-6 text-sm text-slate-600 text-center">No activity yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
