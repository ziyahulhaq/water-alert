import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, Droplet } from 'lucide-react';

export default function Offline() {
  const [retrying, setRetrying] = useState(false);
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Auto-redirect when connection is restored
  useEffect(() => {
    const handleOnline = () => {
      window.location.href = '/';
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const handleRetry = () => {
    setRetrying(true);
    setTimeout(() => {
      if (navigator.onLine) {
        window.location.href = '/';
      } else {
        setRetrying(false);
      }
    }, 1500);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0f172a 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      fontFamily: "'Inter', sans-serif",
      color: 'white',
      textAlign: 'center',
    }}>
      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-10px); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes wave {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

      {/* Animated background blobs */}
      <div style={{
        position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
      }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: `${200 + i * 100}px`,
            height: `${200 + i * 100}px`,
            borderRadius: '50%',
            background: 'rgba(37,99,235,0.06)',
            top: `${20 + i * 25}%`,
            left: `${10 + i * 30}%`,
            animation: `float ${4 + i}s ease-in-out infinite`,
            animationDelay: `${i * 0.5}s`,
          }} />
        ))}
      </div>

      {/* Logo */}
      <div style={{ marginBottom: '2rem', position: 'relative' }}>
        <div style={{
          width: '80px', height: '80px', borderRadius: '20px',
          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 10px 40px rgba(37,99,235,0.4)',
          animation: 'float 3s ease-in-out infinite',
        }}>
          <Droplet size={40} color="white" fill="white" />
        </div>
        {/* Pulse rings */}
        {[0, 0.5, 1].map((delay, i) => (
          <div key={i} style={{
            position: 'absolute', inset: 0, borderRadius: '20px',
            border: '2px solid rgba(37,99,235,0.4)',
            animation: `pulse-ring 2s ease-out infinite`,
            animationDelay: `${delay}s`,
          }} />
        ))}
      </div>

      {/* WiFi off icon */}
      <div style={{
        width: '64px', height: '64px', borderRadius: '50%',
        background: 'rgba(239,68,68,0.15)', border: '2px solid rgba(239,68,68,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '1.5rem',
      }}>
        <WifiOff size={28} color="#ef4444" />
      </div>

      {/* Main message */}
      <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 0.75rem', lineHeight: 1.2 }}>
        No Internet Connection
      </h1>
      <p style={{ fontSize: '1.05rem', opacity: 0.7, margin: '0 0 0.5rem', maxWidth: '320px', lineHeight: 1.6 }}>
        Please reconnect and try again.
      </p>
      <p style={{ fontSize: '0.85rem', opacity: 0.45, margin: '0 0 2.5rem' }}>
        Waiting for connection{dots}
      </p>

      {/* Status indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: '100px', padding: '8px 16px', marginBottom: '2rem', fontSize: '13px',
      }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444',
          boxShadow: '0 0 6px #ef4444',
        }} />
        <span style={{ opacity: 0.8 }}>Offline</span>
      </div>

      {/* Retry button */}
      <button
        id="offline-retry-btn"
        onClick={handleRetry}
        disabled={retrying}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          color: 'white', border: 'none', borderRadius: '12px',
          padding: '14px 28px', fontSize: '15px', fontWeight: 700,
          cursor: retrying ? 'not-allowed' : 'pointer',
          opacity: retrying ? 0.7 : 1,
          boxShadow: '0 4px 20px rgba(37,99,235,0.4)',
          transition: 'all 0.2s',
        }}
      >
        <RefreshCw
          size={18}
          style={retrying ? { animation: 'spin 1s linear infinite' } : {}}
        />
        {retrying ? 'Checking…' : 'Try Again'}
      </button>

      {/* Tip */}
      <p style={{ marginTop: '2rem', fontSize: '12px', opacity: 0.35, maxWidth: '260px', lineHeight: 1.5 }}>
        Previously loaded data may still be available while offline.
      </p>
    </div>
  );
}
