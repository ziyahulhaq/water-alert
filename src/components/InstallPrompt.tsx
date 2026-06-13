import { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS Safari
    const ua = window.navigator.userAgent;
    const iosDevice = /iphone|ipad|ipod/i.test(ua);
    const safariOnly = /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua);
    setIsIOS(iosDevice && safariOnly);

    // Show iOS prompt after delay if not dismissed
    if (iosDevice && safariOnly) {
      const dismissed = sessionStorage.getItem('pwa-install-dismissed');
      if (!dismissed) {
        setTimeout(() => setShowPrompt(true), 3000);
      }
      return;
    }

    // Listen for Android/Chrome install event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      const dismissed = sessionStorage.getItem('pwa-install-dismissed');
      if (!dismissed) {
        setTimeout(() => setShowPrompt(true), 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowPrompt(false);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
    setInstalling(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (isInstalled || !showPrompt) return null;

  return (
    <div
      id="pwa-install-prompt"
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '1rem',
        right: '1rem',
        maxWidth: '420px',
        margin: '0 auto',
        zIndex: 9999,
        animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(100px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)',
        borderRadius: '16px',
        padding: '16px',
        boxShadow: '0 20px 60px rgba(37,99,235,0.4), 0 4px 20px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.15)',
        color: 'white',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.15)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <img src="/icon-192.png" alt="App icon" style={{ width: '36px', height: '36px', borderRadius: '8px' }} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', lineHeight: 1.2 }}>
              Install Water Monitor
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.8, lineHeight: 1.4 }}>
              {isIOS
                ? 'Add to your Home Screen for offline access'
                : 'Install for faster access & offline support'}
            </p>
          </div>

          <button
            id="pwa-dismiss-btn"
            onClick={handleDismiss}
            style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer',
              color: 'white', borderRadius: '50%', width: '28px', height: '28px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* iOS Instructions */}
        {isIOS ? (
          <div style={{ marginTop: '14px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Share size={16} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>How to install on iPhone/iPad:</span>
            </div>
            {['Tap the Share button (□↑) in Safari', "Scroll down and tap 'Add to Home Screen'", "Tap 'Add' to confirm"].map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginTop: '4px', fontSize: '12px', opacity: 0.9 }}>
                <span style={{
                  background: 'rgba(255,255,255,0.2)', borderRadius: '50%', width: '18px', height: '18px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '10px', fontWeight: 700,
                }}>{i + 1}</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        ) : (
          /* Android/Desktop Install Button */
          <div style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
            <button
              id="pwa-install-btn"
              onClick={handleInstall}
              disabled={installing}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                background: 'white', color: '#1d4ed8', border: 'none', borderRadius: '10px',
                padding: '10px 16px', fontWeight: 700, fontSize: '14px', cursor: 'pointer',
                opacity: installing ? 0.7 : 1, transition: 'all 0.2s',
              }}
            >
              {installing ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '14px', height: '14px', border: '2px solid #1d4ed8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                  Installing…
                </span>
              ) : (
                <>
                  <Download size={16} />
                  Install App
                </>
              )}
            </button>
            <button
              onClick={handleDismiss}
              style={{
                background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '10px', padding: '10px 14px', fontSize: '13px', cursor: 'pointer',
              }}
            >
              Not now
            </button>
          </div>
        )}

        {/* Features row */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {[
            { icon: '⚡', label: 'Faster' },
            { icon: '📵', label: 'Offline' },
            { icon: '🔔', label: 'Alerts' },
            { icon: <Smartphone size={12} />, label: 'Native feel' },
          ].map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', opacity: 0.75 }}>
              <span>{f.icon}</span>
              <span>{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
