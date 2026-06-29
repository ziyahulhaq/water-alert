import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase, isDemoMode } from '../lib/supabase';
import { 
  Droplet, 
  LayoutDashboard, 
  History, 
  Settings, 
  Cpu, 
  LogOut, 
  Menu, 
  X, 
  AlertTriangle,
  User
} from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    async function checkUser() {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (mounted) {
          if (!currentUser) {
            navigate('/login');
          } else {
            setUser(currentUser);
          }
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          navigate('/login');
          setLoading(false);
        }
      }
    }

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      if (mounted) {
        if (!session?.user) {
          setUser(null);
          navigate('/login');
        } else {
          setUser(session.user);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Water History', path: '/history', icon: History },
    { name: 'Notification Setup', path: '/notifications', icon: Settings },
    { name: 'Device Pairing', path: '/pair', icon: Cpu },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
          <p className="text-gray-400 text-sm font-medium">Loading AquaFlow Monitor...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-950 text-white">
      {/* Mobile Top Bar */}
      <header className="md:hidden flex items-center justify-between px-5 py-4 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-40">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <Droplet className="w-5 h-5 text-blue-400 fill-blue-400/10" />
          </div>
          <span className="font-bold tracking-tight text-white">AquaFlow</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-gray-400 hover:text-white focus:outline-none"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-slate-950/95 backdrop-blur-md flex flex-col pt-20 px-6 space-y-6">
          <div className="border-b border-slate-800/85 pb-4 mb-2">
            <div className="flex items-center space-x-3 text-sm text-gray-400">
              <User className="w-4 h-4 text-blue-400" />
              <span className="truncate">{user.email}</span>
            </div>
          </div>
          <nav className="flex flex-col space-y-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                      : 'text-gray-400 hover:text-white hover:bg-slate-900/60'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              handleSignOut();
            }}
            className="flex items-center space-x-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-950/20 hover:text-red-300 transition-all text-sm font-medium mt-auto mb-10 border border-red-500/10"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 glass-panel border-r border-slate-800/60 p-6 shrink-0 h-screen sticky top-0">
        <div className="flex items-center space-x-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shadow-[0_0_10px_rgba(37,99,235,0.15)]">
            <Droplet className="w-6 h-6 text-blue-400 fill-blue-400/10" />
          </div>
          <div>
            <h1 className="font-bold tracking-tight text-white text-base">AquaFlow</h1>
            <p className="text-[10px] text-gray-500 font-semibold tracking-wider uppercase">Municipal IoT</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                    : 'text-gray-400 hover:text-white hover:bg-slate-900/40 border border-transparent hover:border-slate-800/60'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-800/60 pt-6 mt-6">
          <div className="flex items-center space-x-3 mb-4 text-xs text-gray-400 px-2">
            <User className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="truncate max-w-[170px]" title={user.email}>{user.email}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center space-x-3 w-full px-4 py-3 rounded-xl text-red-400 hover:bg-red-950/20 hover:text-red-300 transition-all text-sm font-medium border border-transparent hover:border-red-500/15"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Demo Mode Notice */}
        {isDemoMode && (
          <div className="bg-amber-950/50 border-b border-amber-500/20 px-5 py-2.5 flex items-center justify-between text-amber-200 text-xs shrink-0 backdrop-blur-md z-10">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Demo Mode Active:</strong> Using local storage. Refreshing the browser preserves data, but changes are stored locally.
              </span>
            </div>
            <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider">
              Local Sandbox
            </span>
          </div>
        )}

        <div className="flex-1 p-6 md:p-8 max-w-5xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
