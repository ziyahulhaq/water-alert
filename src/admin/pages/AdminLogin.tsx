import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Droplet, ShieldCheck, Eye, EyeOff, AlertTriangle } from 'lucide-react';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail]       = useState('admin123@gmail.com');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      // Check admin role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profile?.role !== 'admin') {
        await supabase.auth.signOut();
        throw new Error('Access denied. This account does not have admin privileges.');
      }

      navigate('/admin/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4"
      style={{ backgroundImage: 'radial-gradient(circle at 70% 20%, rgba(99, 102, 241, 0.12), transparent 50%), radial-gradient(circle at 20% 80%, rgba(6, 182, 212, 0.06), transparent 50%)' }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.2)]">
            <Droplet className="w-8 h-8 text-indigo-400" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white tracking-tight">AquaFlow</h1>
            <div className="flex items-center gap-1.5 justify-center mt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">Admin Panel</span>
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 border border-slate-800/60 rounded-2xl p-8 backdrop-blur-md shadow-2xl">
          <h2 className="text-lg font-bold text-white mb-1">Sign in to Admin</h2>
          <p className="text-sm text-slate-500 mb-6">Only authorized administrators can access this panel.</p>

          {error && (
            <div className="flex items-start gap-2 bg-red-950/50 border border-red-500/30 rounded-xl p-3 mb-5">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors pr-11"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {loading ? 'Signing in...' : 'Sign In to Admin Panel'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Regular user?{' '}
          <a href="/login" className="text-slate-500 hover:text-slate-400 underline">Go to User Login</a>
        </p>
      </div>
    </div>
  );
}
