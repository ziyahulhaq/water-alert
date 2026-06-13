import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { History, AlertCircle, Droplet, DropletOff, Calendar, Cpu, Plus } from 'lucide-react';

interface Device {
  id: string;
}

interface WaterEvent {
  id: string;
  detected_at: string;
  water_level: number;
}

export default function WaterHistory() {
  const [device, setDevice] = useState<Device | null>(null);
  const [events, setEvents] = useState<WaterEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      try {
        // 1. Fetch user's device
        const { data: deviceData, error: deviceError } = await supabase
          .from('devices')
          .select('id')
          .eq('user_id', user.id)
          .then((res: any) => res);

        if (deviceError) throw deviceError;
        const userDevice = deviceData && deviceData.length > 0 ? deviceData[0] : null;

        if (mounted) {
          setDevice(userDevice);
        }

        if (userDevice) {
          // 2. Fetch full water events
          const { data: eventsData, error: eventsError } = await supabase
            .from('water_events')
            .select('*')
            .eq('device_id', userDevice.id)
            .order('detected_at', { ascending: false })
            .limit(50)
            .then((res: any) => res);

          if (eventsError) throw eventsError;

          if (mounted) {
            setEvents(eventsData || []);
          }
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Failed to load water history events.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
          <span className="text-gray-400 text-sm">Loading historical data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white font-sans text-left">Water History</h1>
        <p className="text-gray-400 mt-1">Review the historical log of municipal water supply flow alerts.</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 flex items-start space-x-3 text-red-200 text-sm">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!device ? (
        <div className="glass-card rounded-2xl p-8 text-center flex flex-col items-center justify-center border border-dashed border-slate-700/60 py-12">
          <div className="w-12 h-12 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-center mb-4 text-gray-500">
            <Cpu className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">No Device Paired</h3>
          <p className="text-gray-400 text-xs max-w-sm mb-6 leading-relaxed">
            Please pair a sensor device first to build historical telemetry logs.
          </p>
          <Link
            to="/pair"
            className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded-xl text-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Connect Device</span>
          </Link>
        </div>
      ) : events.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center flex flex-col items-center justify-center border border-slate-800/80 py-12">
          <div className="w-12 h-12 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-center mb-4 text-gray-500">
            <History className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">No Events Recorded</h3>
          <p className="text-gray-400 text-xs max-w-sm leading-relaxed">
            Your sensor is connected! Once it detects changes in water supply flow, logs will populate here. 
            Use the simulator on the Dashboard to trigger mock events.
          </p>
        </div>
      ) : (
        /* Timeline View */
        <div className="relative border-l border-slate-800 ml-4 pl-6 space-y-6 pb-4">
          {events.map((event) => {
            const isDetected = event.water_level === 1;
            return (
              <div key={event.id} className="relative group">
                {/* Timeline node */}
                <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 transition-all ${
                  isDetected 
                    ? 'bg-emerald-400 border-emerald-400/50 shadow-[0_0_8px_rgba(52,211,153,0.4)]' 
                    : 'bg-slate-950 border-slate-700'
                }`}></div>

                {/* Event details card */}
                <div className="glass-card rounded-xl p-4 border border-slate-800/80 hover:border-slate-700/60 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start space-x-3.5">
                    <div className={`w-10 h-10 rounded-lg shrink-0 flex items-center justify-center ${
                      isDetected 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-slate-900/60 text-slate-500 border border-slate-800'
                    }`}>
                      {isDetected ? <Droplet className="w-5 h-5 fill-emerald-500/10" /> : <DropletOff className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">
                        {isDetected ? 'Water Supply Detected' : 'Water Supply Stopped'}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Pressure reading: {isDetected ? 'Flow pressure active' : 'Zero pressure / Dry line'}
                      </p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right text-xs shrink-0 pl-14 sm:pl-0">
                    <div className="flex items-center sm:justify-end text-gray-400 space-x-1.5 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-blue-400" />
                      <span>{formatDate(event.detected_at)}</span>
                    </div>
                    <p className="text-gray-300 font-mono mt-1 font-semibold">
                      {formatTime(event.detected_at)}
                    </p>
                    <p className="text-[10px] text-gray-550 mt-0.5">
                      {formatRelativeTime(event.detected_at)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
