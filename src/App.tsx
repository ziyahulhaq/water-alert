import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import DevicePairing from './pages/DevicePairing';
import NotificationSetup from './pages/NotificationSetup';
import WaterHistory from './pages/WaterHistory';
import Offline from './pages/Offline';
import InstallPrompt from './components/InstallPrompt';

// ─── Admin Panel ──────────────────────────────────────────────
import AdminLogin         from './admin/pages/AdminLogin';
import AdminDashboard     from './admin/pages/AdminDashboard';
import AdminUsers         from './admin/pages/AdminUsers';
import AdminModels        from './admin/pages/AdminModels';
import AdminDevices       from './admin/pages/AdminDevices';
import AdminEvents        from './admin/pages/AdminEvents';
import AdminNotifications from './admin/pages/AdminNotifications';
import AdminSettings      from './admin/pages/AdminSettings';
import AdminGuard         from './admin/components/AdminGuard';
import AdminLayout        from './admin/components/AdminLayout';

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) return <Offline />;

  return (
    <>
      <Router>
        <Routes>
          {/* ── User Routes ─────────────────────────────── */}
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/"             element={<Layout><Dashboard /></Layout>} />
          <Route path="/history"      element={<Layout><WaterHistory /></Layout>} />
          <Route path="/notifications" element={<Layout><NotificationSetup /></Layout>} />
          <Route path="/pair"         element={<Layout><DevicePairing /></Layout>} />
          <Route path="/offline"      element={<Offline />} />

          {/* ── Admin Routes ─────────────────────────────── */}
          <Route path="/admin/login" element={<AdminLogin />} />

          <Route path="/admin/dashboard" element={
            <AdminGuard><AdminLayout><AdminDashboard /></AdminLayout></AdminGuard>
          } />
          <Route path="/admin/users" element={
            <AdminGuard><AdminLayout><AdminUsers /></AdminLayout></AdminGuard>
          } />
          <Route path="/admin/models" element={
            <AdminGuard><AdminLayout><AdminModels /></AdminLayout></AdminGuard>
          } />
          <Route path="/admin/devices" element={
            <AdminGuard><AdminLayout><AdminDevices /></AdminLayout></AdminGuard>
          } />
          <Route path="/admin/events" element={
            <AdminGuard><AdminLayout><AdminEvents /></AdminLayout></AdminGuard>
          } />
          <Route path="/admin/notifications" element={
            <AdminGuard><AdminLayout><AdminNotifications /></AdminLayout></AdminGuard>
          } />
          <Route path="/admin/settings" element={
            <AdminGuard><AdminLayout><AdminSettings /></AdminLayout></AdminGuard>
          } />

          {/* Redirect /admin → /admin/dashboard */}
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>

      <InstallPrompt />
    </>
  );
}

export default App;

