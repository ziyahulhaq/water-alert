import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AlertCircle, CheckCircle2, MessageSquare, Sparkles } from 'lucide-react';

export default function NotificationSetup() {
  const [user, setUser] = useState<any>(null);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadSettings() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        navigate('/login');
        return;
      }
      setUser(currentUser);

      try {
        // Fetch existing notification settings (relying on user_id)
        const { data: settingsData } = await supabase
          .from('notification_settings')
          .select('*')
          .eq('user_id', currentUser.id)
          .single();

        // If settings don't exist yet, we can create them or let the upsert handle it
        if (settingsData) {
          setWhatsappNumber(settingsData.whatsapp_number || '');
          setEnabled(settingsData.enabled ?? false);
        }
      } catch (err: any) {
        console.warn('Could not load notification settings, will create new ones on save.');
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [navigate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError(null);
    setSuccess(false);

    // Basic format validation if enabled is checked
    if (enabled) {
      const cleanPhone = whatsappNumber.replace(/[\s\-\+\(\)]/g, '');
      if (!cleanPhone) {
        setError('WhatsApp number is required when notifications are enabled.');
        return;
      }
      if (cleanPhone.length < 9 || !/^\d+$/.test(cleanPhone)) {
        setError('Please enter a valid phone number (numeric digits only, including country code).');
        return;
      }
    }

    setSaving(true);

    try {
      const { error: upsertError } = await supabase
        .from('notification_settings')
        .upsert({
          user_id: user.id,
          whatsapp_number: whatsappNumber.trim(),
          enabled: enabled
        });

      if (upsertError) throw upsertError;

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save notification settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
          <span className="text-gray-400 text-sm">Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white font-sans text-left">Notification Setup</h1>
        <p className="text-gray-400 mt-1">Configure alerts to receive water availability updates on WhatsApp.</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 flex items-start space-x-3 text-red-200 text-sm">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-start space-x-3 text-emerald-200 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <span>Notification settings saved successfully!</span>
        </div>
      )}

      <div className="glass-card rounded-2xl p-6 border border-slate-800/80">
        <div className="flex items-center space-x-2 text-gray-400 mb-6">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          <span className="text-xs font-semibold uppercase tracking-wider">WhatsApp Delivery Configuration</span>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Notification Switch Toggle Row */}
          <div className="flex items-center justify-between p-4 bg-slate-900/40 border border-slate-850 rounded-xl">
            <div>
              <label htmlFor="notif-toggle" className="text-sm font-semibold text-white cursor-pointer select-none">
                Enable Instant Notifications
              </label>
              <p className="text-xs text-gray-500 mt-0.5">
                Send alert when water supply starts or stops.
              </p>
            </div>
            <button
              id="notif-toggle"
              type="button"
              onClick={() => setEnabled(!enabled)}
              className="focus:outline-none transition-colors duration-200"
            >
              {enabled ? (
                <div className="w-12 h-6 bg-blue-600 rounded-full p-0.5 flex items-center justify-end transition-all">
                  <div className="w-5 h-5 bg-white rounded-full shadow-md"></div>
                </div>
              ) : (
                <div className="w-12 h-6 bg-slate-800 rounded-full p-0.5 flex items-center justify-start transition-all">
                  <div className="w-5 h-5 bg-gray-400 rounded-full shadow-md"></div>
                </div>
              )}
            </button>
          </div>

          {/* WhatsApp input section */}
          <div className={`transition-all duration-300 ${enabled ? 'opacity-100 max-h-40' : 'opacity-50 max-h-40 pointer-events-none'}`}>
            <label className="block text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">
              WhatsApp Number (with Country Code)
            </label>
            <div className="relative">
              <input
                type="text"
                disabled={!enabled}
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="e.g. +919876543210"
                className="w-full bg-slate-900/50 border border-slate-700/60 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm font-mono"
              />
            </div>
            <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
              Include country code without special characters or spaces. Example: +919876543210 (India), +14155552671 (US).
            </p>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
          >
            {saving ? (
              <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <span>Save Preferences</span>
            )}
          </button>
        </form>
      </div>

      {/* Simulator message warning */}
      <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex items-start space-x-4">
        <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20 shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="text-xs leading-relaxed">
          <h5 className="font-semibold text-gray-200 mb-1">WhatsApp Dispatch Note</h5>
          <p className="text-gray-400">
            For demonstration in this MVP sandbox environment, saving settings enables simulated console logs. 
            When water supply status changes, the logs will print the mock Twilio/WhatsApp API webhook dispatch action.
          </p>
        </div>
      </div>
    </div>
  );
}
