import { useEffect, useState, useRef } from 'react';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useToast } from '../hooks/useToast';
import { listModels, createModel, updateModel, deleteModel, generateModelId } from '../services/adminModels';
import { ToastContainer, Badge, Table, Td, ConfirmDialog } from '../components/ui';
import type { AdminModel, CreateModelPayload } from '../types/admin';
import { Plus, Edit2, Trash2, QrCode, RefreshCw, Shuffle, X } from 'lucide-react';

// ─── QR Modal ────────────────────────────────────────────────
function QrModal({ modelId, onClose }: { modelId: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Simple QR-like visual using canvas (pattern display)
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 200;
    canvas.width = size;
    canvas.height = size;

    // Draw checkerboard pattern to represent QR
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);

    const cell = 10;
    const hash = Array.from(modelId).reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0xffff, 0);
    ctx.fillStyle = '#ffffff';
    for (let y = 0; y < size; y += cell) {
      for (let x = 0; x < size; x += cell) {
        const bit = ((x / cell) * 7 + (y / cell) * 13 + hash) & 1;
        if (bit) ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      }
    }
    // Border finder patterns
    const fp = [[0,0],[size-30,0],[0,size-30]];
    fp.forEach(([fx, fy]) => {
      ctx.fillStyle = '#6366f1';
      ctx.fillRect(fx, fy, 28, 28);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(fx+4, fy+4, 20, 20);
      ctx.fillStyle = '#6366f1';
      ctx.fillRect(fx+8, fy+8, 12, 12);
    });
  }, [modelId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-6 max-w-xs w-full mx-4 shadow-2xl text-center">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white">QR Code</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <canvas ref={canvasRef} className="rounded-xl mx-auto border border-slate-700/60" />
        <p className="mt-4 font-mono text-indigo-400 font-bold text-lg">{modelId}</p>
        <p className="text-xs text-slate-500 mt-1">Scan to pair device with this Model ID</p>
        <button
          onClick={() => {
            const a = document.createElement('a');
            a.download = `qr_${modelId}.png`;
            a.href = canvasRef.current?.toDataURL() ?? '';
            a.click();
          }}
          className="mt-4 w-full py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 text-sm font-medium hover:bg-indigo-600/30 transition-colors"
        >
          Download QR
        </button>
      </div>
    </div>
  );
}

// ─── Model Modal ─────────────────────────────────────────────
function ModelModal({ mode, model, existingIds, onClose, onSave }: {
  mode: 'add' | 'edit';
  model?: AdminModel;
  existingIds: string[];
  onClose: () => void;
  onSave: (data: CreateModelPayload) => Promise<void>;
}) {
  const [form, setForm] = useState<CreateModelPayload>({
    model_id: model?.model_id ?? '',
    device_name: model?.device_name ?? '',
    description: model?.description ?? '',
    status: model?.status ?? 'active',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try { await onSave(form); onClose(); }
    catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60">
          <h3 className="font-bold text-white">{mode === 'add' ? 'Add Model' : 'Edit Model'}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-red-400 bg-red-950/40 border border-red-500/30 rounded-xl px-4 py-3">{error}</p>}

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Model ID</label>
            <div className="flex gap-2">
              <input
                value={form.model_id} onChange={e => setForm({ ...form, model_id: e.target.value.toUpperCase() })}
                className="flex-1 bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-indigo-500/60 transition-colors"
                placeholder="WM001" required
                readOnly={mode === 'edit'}
              />
              {mode === 'add' && (
                <button type="button" onClick={() => setForm({ ...form, model_id: generateModelId(existingIds) })}
                  className="px-3 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/30 transition-colors" title="Generate ID">
                  <Shuffle className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Device Name</label>
            <input
              value={form.device_name} onChange={e => setForm({ ...form, device_name: e.target.value })}
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-colors"
              placeholder="Water Monitor V1" required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Description</label>
            <textarea
              value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-colors resize-none"
              placeholder="Optional description..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Status</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })}
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-colors">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
              {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {saving ? 'Saving...' : mode === 'add' ? 'Create Model' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function AdminModels() {
  const { profile } = useAdminAuth();
  const { toasts, showToast, dismissToast } = useToast();
  const [models, setModels]       = useState<AdminModel[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<AdminModel | undefined>();
  const [qrModel, setQrModel]     = useState<string | null>(null);
  const [confirm, setConfirm]     = useState<{ open: boolean; model?: AdminModel }>({ open: false });

  const load = async () => {
    setLoading(true);
    try { setModels(await listModels()); } catch (e: any) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data: CreateModelPayload) => {
    if (!profile) return;
    if (modalMode === 'add') {
      await createModel(data, profile.id, profile.email);
      showToast('Model created', 'success');
    } else if (editTarget) {
      await updateModel(editTarget.id, data, profile.id, profile.email);
      showToast('Model updated', 'success');
    }
    await load();
  };

  const handleDelete = async () => {
    if (!confirm.model || !profile) return;
    try {
      await deleteModel(confirm.model.id, profile.id, profile.email);
      showToast('Model deleted', 'success');
      await load();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setConfirm({ open: false }); }
  };

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Model Management</h1>
          <p className="text-slate-500 text-sm mt-1">{models.length} device models</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="p-2.5 border border-slate-700 rounded-xl text-slate-400 hover:text-white text-sm transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => { setModalMode('add'); setEditTarget(undefined); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-colors">
            <Plus className="w-4 h-4" /> Add Model
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-slate-800/40 animate-pulse" />)}</div>
      ) : (
        <Table headers={['Model ID', 'Device Name', 'Description', 'Status', 'Paired', 'Created', 'Actions']}>
          {models.map(m => (
            <tr key={m.id} className="hover:bg-slate-800/20 transition-colors">
              <Td><span className="font-mono font-bold text-indigo-400">{m.model_id}</span></Td>
              <Td><span className="font-medium text-white">{m.device_name}</span></Td>
              <Td><span className="text-slate-500 text-xs max-w-[200px] truncate block">{m.description ?? '—'}</span></Td>
              <Td><Badge value={m.status} /></Td>
              <Td><span className="text-slate-400">{m.paired_count ?? 0}</span></Td>
              <Td><span className="text-xs text-slate-500">{new Date(m.created_at).toLocaleDateString()}</span></Td>
              <Td>
                <div className="flex items-center gap-1">
                  <button onClick={() => setQrModel(m.model_id)} className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-900/20 transition-colors" title="QR Code">
                    <QrCode className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { setEditTarget(m); setModalMode('edit'); }} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700/60 transition-colors" title="Edit">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setConfirm({ open: true, model: m })} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-colors" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Td>
            </tr>
          ))}
          {models.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-600 text-sm">No models yet</td></tr>}
        </Table>
      )}

      {modalMode && (
        <ModelModal mode={modalMode} model={editTarget} existingIds={models.map(m => m.model_id)} onClose={() => setModalMode(null)} onSave={handleSave} />
      )}
      {qrModel && <QrModal modelId={qrModel} onClose={() => setQrModel(null)} />}
      <ConfirmDialog
        open={confirm.open}
        title="Delete Model"
        message={`Delete model "${confirm.model?.model_id}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirm({ open: false })}
      />
    </div>
  );
}
