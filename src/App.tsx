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
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected routes wrapped in Layout which handles Auth guards */}
          <Route path="/"             element={<Layout><Dashboard /></Layout>} />
          <Route path="/history"      element={<Layout><WaterHistory /></Layout>} />
          <Route path="/notifications" element={<Layout><NotificationSetup /></Layout>} />
          <Route path="/pair"         element={<Layout><DevicePairing /></Layout>} />
          <Route path="/offline"      element={<Offline />} />

          {/* Redirect unknown routes to Dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>

      {/* PWA install prompt — rendered outside Router to always be visible */}
      <InstallPrompt />
    </>
  );
}

export default App;
