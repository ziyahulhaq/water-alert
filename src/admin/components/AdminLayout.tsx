import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAdminAuth } from '../hooks/useAdminAuth';
import {
  LayoutDashboard, Users, Cpu, Activity,
  Bell, Settings, LogOut, Menu, X, Droplet, ShieldCheck,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard',     path: '/admin/dashboard',     icon: LayoutDashboard },
  { label: 'Users',         path: '/admin/users',         icon: Users },
  { label: 'Devices',       path: '/admin/devices',       icon: Cpu },
  { label: 'Events',        path: '/admin/events',        icon: Activity },
  { label: 'Notifications', path: '/admin/notifications', icon: Bell },
  { label: 'Settings',      path: '/admin/settings',      icon: Settings },
];

function SidebarContent({ onNav }: { onNav?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAdminAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-slate-800/60">
        <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
          <Droplet className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-white tracking-tight">AquaFlow</p>
          <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider flex items-center gap-1">
            <ShieldCheck className="w-2.5 h-2.5" /> Admin Panel
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(({ label, path, icon: Icon }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              onClick={onNav}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="p-4 border-t border-slate-800/60 space-y-2">
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/60">
          <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-[11px] font-bold text-indigo-300">
            {profile?.name?.[0]?.toUpperCase() ?? profile?.email?.[0]?.toUpperCase() ?? 'A'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{profile?.name ?? 'Admin'}</p>
            <p className="text-[10px] text-slate-500 truncate">{profile?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-slate-950 text-white">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-slate-900/70 border-r border-slate-800/60 h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* Mobile Header */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="md:hidden flex items-center justify-between px-5 py-4 bg-slate-900/80 border-b border-slate-800/60 sticky top-0 z-30 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <Droplet className="w-4 h-4 text-indigo-400" />
            </div>
            <span className="font-bold text-white text-sm">Admin Panel</span>
          </div>
          <button onClick={() => setMobileOpen(true)} className="text-slate-400 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
        </header>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <aside className="relative w-72 bg-slate-900 border-r border-slate-800/60 h-full flex flex-col">
              <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
              <SidebarContent onNav={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 md:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
