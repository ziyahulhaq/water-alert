import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ui';
import { Bell, Send, Users, Cpu, MessageSquare, Radio } from 'lucide-react';

type Target = 'all' | 'selected';

export default function AdminNotifications() {
  const { toasts, showToast, dismissToast } = useToast();
  const [target, setTarget]   = useState<Target>('all');
  const [title, setTitle]     = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setSending(true);
    try {
      // Log broadcast to audit_logs
      await supabase.from('audit_logs').insert({
        action: 'BROADCAST_SENT',
        actor_email: 'admin',
        details: { title, message, target },
      });
      showToast(`Broadcast sent to ${target === 'all' ? 'all users' : 'selected users'}`, 'success');
      setTitle('');
      setMessage('');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Bell className="w-6 h-6 text-amber-400" /> Notification Center
        </h1>
        <p className="text-slate-500 text-sm mt-1">Send broadcast messages and push alerts to users</p>
      </div>

      {/* Broadcast Form */}
      <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-800/40">
          <Radio className="w-4 h-4 text-amber-400" />
          <h2 className="font-semibold text-white">Send Broadcast</h2>
        </div>
        <form onSubmit={handleSend} className="p-6 space-y-5">
          {/* Target */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">Target Audience</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'all',      icon: Users,  label: 'All Users' },
                { value: 'selected', icon: Cpu,    label: 'Selected Devices' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTarget(opt.value as Target)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                    target === opt.value
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                      : 'bg-slate-800/40 border-slate-700/40 text-slate-400 hover:text-white hover:border-slate-600'
                  }`}
                >
                  <opt.icon className="w-4 h-4" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Notification Title</label>
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              required
              placeholder="e.g. Water Supply Update"
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Message</label>
            <textarea
              value={message} onChange={e => setMessage(e.target.value)}
              required rows={5}
              placeholder="Enter your broadcast message here..."
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition-colors resize-none"
            />
            <p className="text-xs text-slate-600 mt-1">{message.length} characters</p>
          </div>

          <button
            type="submit"
            disabled={sending || !title.trim() || !message.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-colors"
          >
            {sending ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? 'Sending...' : 'Send Broadcast'}
          </button>
        </form>
      </div>

      {/* WhatsApp Info */}
      <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-4 h-4 text-emerald-400" />
          <h2 className="font-semibold text-white">WhatsApp Alerts</h2>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed">
          WhatsApp alerts are sent automatically by the ESP32 device when water is detected or stopped.
          Configure WhatsApp settings in the <strong className="text-slate-400">Settings</strong> page.
        </p>
      </div>
    </div>
  );
}
