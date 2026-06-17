import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Droplet,
  DropletOff,
  Activity,
  Clock,
  AlertCircle,
  Wifi,
  WifiOff,
  Plus,
  ArrowRight,
  TrendingUp,
  Cpu,
  Sparkles,
  CheckCircle2,
  Sliders,
  Send,
} from 'lucide-react';

interface Device {
  id: string;
  mac_hash?: string;
  model_id?: string;
  status: string;
  last_seen: string | null;
  threshold_no_water_max?: number;
  threshold_low_max?: number;
  threshold_medium_max?: number;
  alert_threshold?: number;
  reset_threshold?: number;
}

interface WaterEvent {
  id: string;
  detected_at: string;
  water_level: number;
}

interface Profile {
  link_token: string | null;
  chat_id: string | null;
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [recentEvents, setRecentEvents] = useState<WaterEvent[]>([]);
  const [lastDetection, setLastDetection] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [simulatorOpen, setSimulatorOpen] = useState(true);
  const [simulating, setSimulating] = useState(false);
  // Threshold request state
  const [reqMessage, setReqMessage] = useState('');
  const [reqSending, setReqSending] = useState(false);
  const [reqSent, setReqSent] = useState(false);
  const [reqError, setReqError] = useState('');

  const navigate = useNavigate();

  const fetchDashboardData = useCallback(async (userId: string) => {
    try {
      // 1. Get user's devices through user_device junction table
      const { data: links, error: linkError } = await supabase
        .from('user_device')
        .select('device_id, devices(id, model_id, mac_hash, status, last_seen, threshold_no_water_max, threshold_low_max, threshold_medium_max, alert_threshold, reset_threshold)')
        .eq('user_id', userId);

      if (linkError) throw linkError;

      const userDevice = (links?.[0]?.devices as any) ?? null;
      setDevice(userDevice);

      // Thresholds are now managed in admin panel (read-only here)

      if (userDevice) {
        // 2. Fetch recent events
        const { data: eventsData, error: eventsError } = await supabase
          .from('water_events')
          .select('*')
          .eq('device_id', userDevice.id)
          .order('detected_at', { ascending: false })
          .limit(5)
          .then((res: any) => res);

        if (eventsError) throw eventsError;
        setRecentEvents(eventsData || []);

        // 3. Fetch last detection event (handle both numeric 1 and text HIGH/MEDIUM)
        const { data: lastDetectData, error: lastDetectError } = await supabase
          .from('water_events')
          .select('*')
          .eq('device_id', userDevice.id)
          .or('water_level.eq.1,water_level.ilike.HIGH,water_level.ilike.MEDIUM')
          .order('detected_at', { ascending: false })
          .limit(1)
          .then((res: any) => res);

        if (lastDetectError) throw lastDetectError;

        const lastDetect = lastDetectData && lastDetectData.length > 0 ? lastDetectData[0] : null;
        setLastDetection(lastDetect ? lastDetect.detected_at : null);
      }

      // 4. Fetch Telegram link profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('link_token, chat_id')
        .eq('id', userId)
        .single();
      setProfile(profileData ?? null);

    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function getUserAndData() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (mounted) {
        if (!currentUser) {
          navigate('/login');
          return;
        }
        setUser(currentUser);
        await fetchDashboardData(currentUser.id);
      }
    }

    getUserAndData();

    // Poll every 10 s only — stop if error occurs
    const interval = setInterval(async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser && mounted) {
        await fetchDashboardData(currentUser.id);
      }
    }, 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [navigate, fetchDashboardData]);

  // ESP32 Simulator Controls
  const handleSimulateStatus = async (status: 'online' | 'offline') => {
    if (!device) return;
    setSimulating(true);
    try {
      const { error: updateError } = await supabase
        .from('devices')
        .update({ status, last_seen: new Date().toISOString() })
        .eq('id', device.id);

      if (updateError) throw updateError;
      await fetchDashboardData(user.id);
    } catch (err: any) {
      alert('Simulation error: ' + err.message);
    } finally {
      setSimulating(false);
    }
  };

  const handleSimulateWaterEvent = async (waterLevel: number) => {
    if (!device) return;
    setSimulating(true);
    try {
      // 1. Insert water event
      const { error: insertError } = await supabase
        .from('water_events')
        .insert({
          device_id: device.id,
          detected_at: new Date().toISOString(),
          water_level: waterLevel
        });

      if (insertError) throw insertError;

      // 2. Automatically set device online and update last_seen
      await supabase
        .from('devices')
        .update({ status: 'online', last_seen: new Date().toISOString() })
        .eq('id', device.id);

      // 3. WhatsApp dispatch simulation in console
      const { data: settings } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (settings?.enabled && settings?.whatsapp_number) {
        console.log(
          `%c[WhatsApp Simulation] SMS alert sent to ${settings.whatsapp_number}: Water supply is now ${waterLevel === 1 ? 'AVAILABLE ✅' : 'NOT AVAILABLE ❌'}`,
          'background: #25D366; color: black; font-weight: bold; padding: 4px 8px; border-radius: 4px;'
        );
      }

      await fetchDashboardData(user.id);
    } catch (err: any) {
      alert('Simulation error: ' + err.message);
    } finally {
      setSimulating(false);
    }
  };



  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Handles both numeric (1) from simulator and text (HIGH/MEDIUM) from ESP32
  const isWaterDetected = (level: any): boolean => {
    if (level === 1 || level === '1') return true;
    if (typeof level === 'string') {
      const l = level.toUpperCase();
      return l === 'HIGH' || l === 'MEDIUM';
    }
    return false;
  };

  const getLevelLabel = (level: any): string => {
    if (typeof level === 'string' && level.trim() !== '') {
      const l = level.toUpperCase();
      if (l === 'HIGH') return 'High (Flow active)';
      if (l === 'MEDIUM') return 'Medium (Flow active)';
      if (l === 'LOW') return 'Low (Dry / Stop)';
      return level;
    }
    return level === 1 ? 'High (Flow active)' : 'Low (Dry / Stop)';
  };


  const isWaterAvailable = recentEvents.length > 0 && isWaterDetected(recentEvents[0].water_level) && device?.status === 'online';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
          <span className="text-gray-400 text-sm">Loading telemetry...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Welcome Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">Real-time municipal water supply stats and status.</p>
        </div>
        {!device && (
          <Link
            to="/pair"
            className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30"
          >
            <Plus className="w-4 h-4" />
            <span>Pair ESP32 Device</span>
          </Link>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 flex items-start space-x-3 text-red-200 text-sm">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <span>Error loading data: {error}</span>
        </div>
      )}

      {/* Main dashboard content */}
      {!device ? (
        /* Empty State */
        <div className="glass-card rounded-2xl p-10 text-center flex flex-col items-center justify-center border border-dashed border-slate-700/60 max-w-xl mx-auto my-10 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="w-16 h-16 bg-slate-900/60 rounded-2xl border border-slate-800 flex items-center justify-center mb-6">
            <Cpu className="w-8 h-8 text-gray-500" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Device Connected</h3>
          <p className="text-gray-400 text-sm max-w-sm mb-8 leading-relaxed">
            In order to monitor municipal water availability, you need to connect your ESP32 water sensing device.
          </p>
          <Link
            to="/pair"
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40"
          >
            <Plus className="w-5 h-5" />
            <span>Connect ESP32 Sensor</span>
          </Link>
        </div>
      ) : (
        /* Telemetry Dashboard */
        <div className="space-y-8">
          {/* Top Section: Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Water Supply Status Card */}
            <div className={`glass-card rounded-2xl p-6 relative overflow-hidden transition-all ${isWaterAvailable
              ? 'border-emerald-500/30 bg-emerald-950/10 shadow-[0_0_20px_rgba(16,185,129,0.05)] animate-glow-green'
              : 'border-slate-800/80'
              }`}>
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Water Availability</span>
                  <h2 className="text-3xl font-extrabold text-white mt-2 flex items-center">
                    {isWaterAvailable ? (
                      <span className="text-emerald-400 flex items-center gap-2">
                        Available
                      </span>
                    ) : (
                      <span className="text-gray-400 flex items-center gap-2">
                        Not Available
                      </span>
                    )}
                  </h2>
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isWaterAvailable
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-slate-900/60 text-slate-500 border border-slate-800'
                  }`}>
                  {isWaterAvailable ? (
                    <Droplet className="w-6 h-6 fill-emerald-500/20" />
                  ) : (
                    <DropletOff className="w-6 h-6" />
                  )}
                </div>
              </div>
              <div className="mt-6 flex items-center text-xs text-gray-400">
                <span className="flex h-2 w-2 relative mr-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isWaterAvailable ? 'bg-emerald-400' : 'bg-slate-500'
                    }`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isWaterAvailable ? 'bg-emerald-500' : 'bg-slate-500'
                    }`}></span>
                </span>
                <span>
                  {device.status === 'offline'
                    ? 'Device offline (Status frozen)'
                    : isWaterAvailable
                      ? 'Water sensor currently detecting supply flow'
                      : 'No water supply flow detected'
                  }
                </span>
              </div>
            </div>

            {/* Device Status Card */}
            <div className={`glass-card rounded-2xl p-6 relative overflow-hidden transition-all ${device.status === 'online'
              ? 'border-blue-500/30 bg-blue-950/10 shadow-[0_0_20px_rgba(59,130,246,0.05)] animate-glow-blue'
              : 'border-slate-800/80'
              }`}>
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Device Status</span>
                  <h2 className="text-3xl font-extrabold text-white mt-2 flex items-center">
                    {device.status === 'online' ? (
                      <span className="text-blue-400 flex items-center gap-2">
                        Online
                      </span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-2">
                        Offline
                      </span>
                    )}
                  </h2>
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${device.status === 'online'
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                  {device.status === 'online' ? (
                    <Wifi className="w-6 h-6" />
                  ) : (
                    <WifiOff className="w-6 h-6" />
                  )}
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between text-xs text-gray-400">
                <span className="truncate">Device: <code className="bg-slate-900/60 px-1.5 py-0.5 rounded text-[10px] text-gray-300 font-mono">{device.model_id ?? device.mac_hash?.slice(0, 12) ?? '—'}</code></span>
                <span>Seen: {formatRelativeTime(device.last_seen)}</span>
              </div>
            </div>
          </div>


          {/* Middle Section: Last Water Detection */}
          <div className="glass-card rounded-2xl p-6 border border-slate-800/80">
            <div className="flex items-center space-x-3 text-gray-400 mb-4">
              <Clock className="w-5 h-5 text-blue-400" />
              <span className="text-xs font-semibold uppercase tracking-wider">Last Water Detection</span>
            </div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-2xl font-bold text-white">
                  {lastDetection ? new Date(lastDetection).toLocaleString([], {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  }) : 'No water flow events recorded'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Time elapsed since the water sensor last detected supply pressure: <span className="text-blue-400 font-semibold">{formatRelativeTime(lastDetection)}</span>
                </p>
              </div>
              {lastDetection && (
                <div className="flex items-center space-x-2 bg-blue-950/20 border border-blue-500/10 px-4 py-2 rounded-xl text-blue-300 text-xs">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  <span>Pressure verified</span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Section: Recent Water Events */}
          <div className="glass-card rounded-2xl p-6 border border-slate-800/80">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3 text-gray-400">
                <Activity className="w-5 h-5 text-blue-400" />
                <span className="text-xs font-semibold uppercase tracking-wider">Recent Water Supply Events</span>
              </div>
              <Link
                to="/history"
                className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                <span>Full History</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recentEvents.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No events recorded yet. Turn on the simulator below to mock ESP32 data.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/60 text-xs text-gray-400 uppercase font-semibold">
                      <th className="pb-3 pl-2">Event Time</th>
                      <th className="pb-3">Water Level</th>
                      <th className="pb-3 text-right pr-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-slate-800/30">
                    {recentEvents.map((event) => (
                      <tr key={event.id} className="hover:bg-slate-900/20 transition-colors">
                        <td className="py-3 pl-2 text-gray-300 font-mono">
                          {new Date(event.detected_at).toLocaleString()}
                        </td>
                        <td className="py-3 text-gray-400 font-medium">
                          {getLevelLabel(event.water_level)}
                        </td>
                        <td className="py-3 text-right pr-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isWaterDetected(event.water_level)
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                            : 'bg-slate-800 text-gray-400 border border-slate-700/30'
                            }`}>
                            {isWaterDetected(event.water_level) ? 'Water Detected' : 'Stopped'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Request Threshold Adjustment */}
          {device && (
            <div className="glass-card rounded-2xl p-6 border border-cyan-500/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <Sliders className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Water Level Thresholds</p>
                  <p className="text-xs text-gray-500">Managed by admin — send a request to adjust</p>
                </div>
              </div>

              {reqSent ? (
                <div className="flex items-center gap-2 bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-4">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-sm text-emerald-300 font-medium">Request sent!</p>
                    <p className="text-xs text-emerald-400/60">Admin will review your request and adjust the thresholds.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={reqMessage}
                    onChange={e => setReqMessage(e.target.value)}
                    placeholder="Describe the issue (e.g. 'Water alert triggers too late, please lower the alert threshold to 500')..."
                    rows={3}
                    className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 resize-none transition-colors"
                  />
                  {reqError && <p className="text-xs text-red-400">{reqError}</p>}
                  <button
                    onClick={async () => {
                      if (!reqMessage.trim()) { setReqError('Please describe what you need adjusted'); return; }
                      if (!user || !device) return;
                      setReqSending(true); setReqError('');
                      try {
                        const { data: prof } = await supabase.from('profiles').select('email, name').eq('id', user.id).single();
                        const { error: err } = await supabase.from('threshold_requests').insert({
                          device_id: device.id,
                          user_id: user.id,
                          user_email: prof?.email ?? user.email,
                          user_name: prof?.name ?? '',
                          message: reqMessage.trim(),
                        });
                        if (err) throw err;
                        setReqSent(true);
                        setReqMessage('');
                        setTimeout(() => setReqSent(false), 10000);
                      } catch (e: any) { setReqError(e.message); }
                      finally { setReqSending(false); }
                    }}
                    disabled={reqSending || !reqMessage.trim()}
                    className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
                  >
                    {reqSending
                      ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <Send className="w-4 h-4" />}
                    {reqSending ? 'Sending...' : 'Request Threshold Adjustment'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Telegram Connect Card */}
          <div className={`glass-card rounded-2xl p-6 border transition-all ${profile?.chat_id
            ? 'border-green-500/30 bg-green-950/10'
            : 'border-blue-500/20'
            }`}>
            <div className="flex items-start justify-between flex-wrap gap-6">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${profile?.chat_id ? 'bg-green-500/15' : 'bg-blue-500/15'
                  }`}>
                  {profile?.chat_id ? '✅' : '📱'}
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-0.5">
                    Telegram Alerts
                  </p>
                  {profile?.chat_id ? (
                    <p className="text-green-400 font-bold text-lg">Connected ✓</p>
                  ) : (
                    <p className="text-white font-bold text-lg">Not Connected</p>
                  )}
                  <p className="text-gray-500 text-xs mt-0.5">
                    {profile?.chat_id
                      ? 'You will receive water supply alerts on Telegram'
                      : 'Link Telegram to receive instant water alerts'}
                  </p>
                </div>
              </div>

              {profile?.chat_id ? (
                <span className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium px-4 py-2 rounded-xl">
                  <CheckCircle2 className="w-4 h-4" />
                  Telegram Linked
                </span>
              ) : profile?.link_token ? (
                <div className="flex flex-col gap-3 w-full md:w-auto">
                  {/* Step instructions */}
                  <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 space-y-3">
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">How to connect:</p>
                    <div className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <p className="text-gray-300 text-sm">
                        Open{' '}
                        <a
                          href={`https://t.me/${import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'tastTestwaterbot'}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-blue-400 underline"
                        >
                          @{import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'tastTestwaterbot'}
                        </a>
                        {' '}on Telegram
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <p className="text-gray-300 text-sm">Send this command:</p>
                    </div>
                    {/* Code box */}
                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3">
                      <code className="text-blue-300 font-mono text-base tracking-widest font-bold flex-1">
                        /link {profile.link_token.substring(0, 8).toUpperCase()}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`/link ${profile!.link_token!.substring(0, 8).toUpperCase()}`);
                        }}
                        className="text-xs text-gray-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded transition-all"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="text-gray-600 text-xs">
                      💡 Tap <strong>Copy</strong>, then paste in Telegram and send
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-red-400">⚠️ No token — run the SQL migration in Supabase first</p>
              )}
            </div>
          </div>


          <div className="glass-card rounded-2xl border border-blue-500/20 shadow-[0_0_25px_rgba(59,130,246,0.05)] overflow-hidden">
            <button
              onClick={() => setSimulatorOpen(!simulatorOpen)}
              className="w-full flex items-center justify-between p-4 bg-slate-900/60 hover:bg-slate-900/80 border-b border-slate-850 transition-colors"
            >
              <div className="flex items-center space-x-2.5 text-blue-400">
                <Cpu className="w-5 h-5" />
                <span className="font-semibold text-sm">ESP32 Hardware Simulator</span>
                <span className="bg-blue-500/10 text-blue-300 text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider border border-blue-500/20 flex items-center gap-1 font-bold">
                  <Sparkles className="w-2.5 h-2.5" /> Interactive Sandbox
                </span>
              </div>
              <span className="text-xs text-gray-400 font-medium">
                {simulatorOpen ? 'Collapse' : 'Expand Controls'}
              </span>
            </button>

            {simulatorOpen && (
              <div className="p-6 bg-slate-950/40 space-y-6">
                <p className="text-xs text-gray-400 leading-relaxed">
                  Use these controls to simulate the hardware ESP32 device sending data packets to your Supabase tables.
                  Simulated WhatsApp notification SMS will trigger output in the browser console.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Status control */}
                  <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl space-y-3">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold block">Device Connectivity</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSimulateStatus('online')}
                        disabled={simulating || device.status === 'online'}
                        className="flex-1 bg-blue-600/15 border border-blue-500/30 hover:bg-blue-600/30 hover:border-blue-500/50 disabled:bg-blue-600/40 disabled:border-blue-500/60 text-white font-medium py-2 rounded-lg text-xs transition-all disabled:opacity-80"
                      >
                        Set Online
                      </button>
                      <button
                        onClick={() => handleSimulateStatus('offline')}
                        disabled={simulating || device.status === 'offline'}
                        className="flex-1 bg-red-600/15 border border-red-500/30 hover:bg-red-600/30 hover:border-red-500/50 disabled:bg-red-600/40 disabled:border-red-500/60 text-white font-medium py-2 rounded-lg text-xs transition-all disabled:opacity-80"
                      >
                        Set Offline
                      </button>
                    </div>
                  </div>

                  {/* Water sensor control */}
                  <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl space-y-3">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold block">Water Flow Sensor (Pin D2)</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSimulateWaterEvent(1)}
                        disabled={simulating}
                        className="flex-1 bg-emerald-600/15 border border-emerald-500/30 hover:bg-emerald-600/30 hover:border-emerald-500/50 text-white font-medium py-2 rounded-lg text-xs transition-all"
                      >
                        Start Water Flow
                      </button>
                      <button
                        onClick={() => handleSimulateWaterEvent(0)}
                        disabled={simulating}
                        className="flex-1 bg-slate-800 border border-slate-700/50 hover:bg-slate-800/80 text-white font-medium py-2 rounded-lg text-xs transition-all"
                      >
                        Stop Water Flow
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


    </div>
  );
}

