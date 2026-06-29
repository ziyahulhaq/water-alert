import { useEffect, useState } from 'react';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useToast } from '../hooks/useToast';
import { listUsers, createUser, updateUser, deleteUser, toggleUserStatus } from '../services/adminUsers';
import { ToastContainer, Badge, Table, Td, ConfirmDialog } from '../components/ui';
import type { AdminUser, CreateUserPayload, UpdateUserPayload } from '../types/admin';
import { DEFAULT_ADMIN_EMAIL } from '../types/admin';
import { Plus, Search, Edit2, Trash2, UserX, UserCheck, X, Eye, EyeOff, RefreshCw } from 'lucide-react';

// ─── Add/Edit Modal ──────────────────────────────────────────
function UserModal({
  mode, user, onClose, onSave,
}: {
  mode: 'add' | 'edit';
  user?: AdminUser;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const [form, setForm] = useState<any>({
    name: user?.name ?? '',
    email: user?.email ?? '',
    password: '',
    role: user?.role ?? 'user',
    status: user?.status ?? 'active',
  });
  const [showPw, setShowPw]   = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

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
          <h3 className="font-bold text-white">{mode === 'add' ? 'Add New User' : 'Edit User'}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-red-400 bg-red-950/40 border border-red-500/30 rounded-xl px-4 py-3">{error}</p>}

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Full Name</label>
            <input
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-colors"
              placeholder="John Doe" required
            />
          </div>

          {mode === 'add' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Email</label>
                <input
                  type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-colors"
                  placeholder="user@example.com" required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'} value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-colors pr-10"
                    placeholder="Min 6 characters" required minLength={6}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Role</label>
              <select
                value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-colors"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Status</label>
              <select
                value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-colors"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
              {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {saving ? 'Saving...' : mode === 'add' ? 'Create User' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function AdminUsers() {
  const { profile } = useAdminAuth();
  const { toasts, showToast, dismissToast } = useToast();
  const [users, setUsers]         = useState<AdminUser[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [roleFilter, setRoleFilter]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<AdminUser | undefined>();
  const [confirm, setConfirm]     = useState<{ open: boolean; user?: AdminUser }>({ open: false });

  const load = async () => {
    setLoading(true);
    try { setUsers(await listUsers()); } catch (e: any) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole   = !roleFilter   || u.role   === roleFilter;
    const matchStatus = !statusFilter || u.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  const handleSave = async (data: CreateUserPayload | UpdateUserPayload) => {
    if (!profile) return;
    if (modalMode === 'add') {
      await createUser(data as CreateUserPayload, profile.id, profile.email);
      showToast('User created successfully', 'success');
    } else if (editTarget) {
      await updateUser(editTarget.id, data as UpdateUserPayload, profile.id, profile.email);
      showToast('User updated successfully', 'success');
    }
    await load();
  };

  const handleDelete = async () => {
    if (!confirm.user || !profile) return;
    try {
      await deleteUser(confirm.user.id, profile.id, profile.email);
      showToast('User deleted', 'success');
      await load();
    } catch (e: any) { showToast(e.message, 'error'); }
    finally { setConfirm({ open: false }); }
  };

  const handleToggleStatus = async (user: AdminUser) => {
    if (!profile) return;
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await toggleUserStatus(user.id, newStatus, profile.id, profile.email);
      showToast(`User ${newStatus === 'active' ? 'activated' : 'deactivated'}`, 'success');
      await load();
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  const isProtected = (u: AdminUser) => u.email === DEFAULT_ADMIN_EMAIL || u.id === profile?.id;

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-slate-500 text-sm mt-1">{users.length} users registered</p>
        </div>
        <button
          onClick={() => { setModalMode('add'); setEditTarget(undefined); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-colors"
          />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-colors">
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-colors">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 border border-slate-700 rounded-xl text-slate-400 hover:text-white text-sm transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-slate-800/40 animate-pulse" />)}
        </div>
      ) : (
        <Table headers={['User', 'Role', 'Status', 'Created', 'Actions']}>
          {filtered.map(u => (
            <tr key={u.id} className="hover:bg-slate-800/20 transition-colors">
              <Td>
                <div>
                  <p className="font-medium text-white text-sm">{u.name ?? '—'}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                  {u.email === DEFAULT_ADMIN_EMAIL && (
                    <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">Super Admin</span>
                  )}
                </div>
              </Td>
              <Td><Badge value={u.role} /></Td>
              <Td><Badge value={u.status} /></Td>
              <Td><span className="text-xs text-slate-500">{new Date(u.created_at).toLocaleDateString()}</span></Td>
              <Td>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setEditTarget(u); setModalMode('edit'); }}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700/60 transition-colors"
                    title="Edit"
                  ><Edit2 className="w-3.5 h-3.5" /></button>
                  <button
                    onClick={() => handleToggleStatus(u)}
                    disabled={isProtected(u)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-900/20 transition-colors disabled:opacity-30"
                    title={u.status === 'active' ? 'Deactivate' : 'Activate'}
                  >{u.status === 'active' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}</button>
                  <button
                    onClick={() => setConfirm({ open: true, user: u })}
                    disabled={isProtected(u)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-30"
                    title="Delete"
                  ><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </Td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-600 text-sm">No users found</td></tr>
          )}
        </Table>
      )}

      {/* Modals */}
      {modalMode && (
        <UserModal mode={modalMode} user={editTarget} onClose={() => setModalMode(null)} onSave={handleSave} />
      )}
      <ConfirmDialog
        open={confirm.open}
        title="Delete User"
        message={`Are you sure you want to permanently delete ${confirm.user?.email}? This cannot be undone.`}
        confirmLabel="Delete User"
        onConfirm={handleDelete}
        onCancel={() => setConfirm({ open: false })}
      />
    </div>
  );
}
