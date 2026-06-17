import { type ReactNode } from 'react';
import type { ToastType } from '../types/admin';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

const config: Record<ToastType, { icon: React.ElementType; classes: string }> = {
  success: { icon: CheckCircle2, classes: 'bg-emerald-950 border-emerald-500/40 text-emerald-300' },
  error:   { icon: XCircle,      classes: 'bg-red-950 border-red-500/40 text-red-300' },
  info:    { icon: Info,         classes: 'bg-blue-950 border-blue-500/40 text-blue-300' },
  warning: { icon: AlertTriangle,classes: 'bg-amber-950 border-amber-500/40 text-amber-300' },
};

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map(toast => {
        const { icon: Icon, classes } = config[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md pointer-events-auto animate-in slide-in-from-right-5 ${classes}`}
          >
            <Icon className="w-5 h-5 mt-0.5 shrink-0" />
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            <button onClick={() => onDismiss(toast.id)} className="opacity-60 hover:opacity-100 transition-opacity">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: 'blue' | 'indigo' | 'emerald' | 'rose' | 'amber' | 'cyan' | 'purple' | 'slate';
  sub?: string;
  children?: ReactNode;
}

const colorMap: Record<StatCardProps['color'], string> = {
  blue:    'bg-blue-500/10 border-blue-500/20 text-blue-400',
  indigo:  'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
  emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  rose:    'bg-rose-500/10 border-rose-500/20 text-rose-400',
  amber:   'bg-amber-500/10 border-amber-500/20 text-amber-400',
  cyan:    'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
  purple:  'bg-purple-500/10 border-purple-500/20 text-purple-400',
  slate:   'bg-slate-500/10 border-slate-500/20 text-slate-400',
};

export function StatCard({ label, value, icon: Icon, color, sub }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-5 flex items-center gap-4 hover:border-slate-700/60 transition-colors">
      <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${colorMap[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-slate-500 font-medium mt-0.5">{label}</p>
        {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Confirm Dialog ──────────────────────────────────────────
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger = true, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              danger
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Badge ───────────────────────────────────────────────────
export function Badge({ value, type }: { value: string; type?: 'role' | 'status' | 'device' }) {
  const classes: Record<string, string> = {
    admin:    'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    user:     'bg-slate-500/15 text-slate-400 border-slate-500/30',
    active:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    inactive: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    online:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    offline:  'bg-slate-500/15 text-slate-400 border-slate-500/30',
    HIGH:     'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    MEDIUM:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
    LOW:      'bg-amber-500/15 text-amber-400 border-amber-500/30',
  };
  const cls = classes[value] ?? 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cls}`}>
      {value}
    </span>
  );
}

// ─── Table ───────────────────────────────────────────────────
export function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800/60">
      <table className="w-full text-sm">
        <thead className="bg-slate-900/80">
          <tr>
            {headers.map(h => (
              <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/40">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-slate-300 whitespace-nowrap ${className}`}>{children}</td>;
}
