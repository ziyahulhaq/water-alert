import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Cpu, AlertCircle, Camera, CheckCircle2, RefreshCw, QrCode } from 'lucide-react';

export default function DevicePairing() {
  const [user, setUser] = useState<any>(null);
  const [modelId, setModelId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scannerActive, setScannerActive] = useState(true);
  const navigate = useNavigate();
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    async function checkUser() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        navigate('/login');
        return;
      }
      setUser(currentUser);
    }
    checkUser();
  }, [navigate]);

  useEffect(() => {
    if (!scannerActive || success || !user) return;

    // Initialize HTML5 QR Scanner
    const scanner = new Html5QrcodeScanner(
      'reader',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      },
      /* verbose= */ false
    );

    scannerRef.current = scanner;

    const onScanSuccess = async (decodedText: string) => {
      // Clean up the decoded text (trim whitespace)
      const scannedMac = decodedText.trim();
      if (scannedMac) {
        scanner.clear();
        setScannerActive(false);
        await handlePairing(scannedMac);
      }
    };

    const onScanFailure = () => {
      // Silently ignore scans that fail to find a code in the frame
    };

    scanner.render(onScanSuccess, onScanFailure);

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch((err) => {
          console.warn('Failed to clear scanner on unmount:', err);
        });
      }
    };
  }, [scannerActive, success, user]);

  const handlePairing = async (targetId: string) => {
    const cleanId = targetId.trim().toUpperCase();
    if (!cleanId) {
      setError('Please provide a valid Model ID');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // 1. Find device by model_id (MAC stays hidden)
      const { data: device, error: findError } = await supabase
        .from('devices')
        .select('id, model_id')
        .ilike('model_id', cleanId)
        .single();

      if (findError || !device) {
        throw new Error(`Device "${cleanId}" not found. Check the Model ID on your device.`);
      }

      // 2. Check if already linked to a different web user
      const { data: existing } = await supabase
        .from('user_device')
        .select('id, user_id')
        .eq('device_id', device.id)
        .not('user_id', 'is', null)
        .maybeSingle();

      if (existing && existing.user_id !== user.id) {
        throw new Error('This device is already linked to another account.');
      }

      // 3. Link device to this web user via user_device
      const { error: linkError } = await supabase
        .from('user_device')
        .upsert(
          { user_id: user.id, device_id: device.id },
          { onConflict: 'user_id,device_id' }
        );

      if (linkError) throw linkError;

      // 4. Update device status/last_seen
      await supabase.from('devices').update({
        status:    'online',
        last_seen: new Date().toISOString(),
      }).eq('id', device.id);

      setSuccess(true);
      setTimeout(() => navigate('/'), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to pair device. Please check the Model ID.');
      setScannerActive(true);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handlePairing(modelId);
  };

  const handleResetScanner = () => {
    setError(null);
    setScannerActive(false);
    setTimeout(() => {
      setScannerActive(true);
    }, 100);
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white font-sans">Pair Sensor Device</h1>
        <p className="text-gray-400 mt-1">Scan the QR code on your device or type the *Model ID* printed on the label.</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 flex items-start space-x-3 text-red-200 text-sm">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{error}</span>
            <button
              onClick={handleResetScanner}
              className="block mt-2 text-xs text-blue-400 hover:text-blue-300 font-semibold underline"
            >
              Restart Scanner
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-start space-x-3 text-emerald-200 text-sm animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <span>Device paired successfully! Redirecting to notification setup...</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Side: Scanner */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800/80 flex flex-col items-center">
          <div className="flex items-center space-x-2 text-gray-400 mb-6 w-full">
            <Camera className="w-5 h-5 text-blue-400" />
            <span className="text-xs font-semibold uppercase tracking-wider">QR Code Scanner</span>
          </div>

          {scannerActive && !success ? (
            <div className="w-full relative aspect-square max-w-[280px] bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
              <div id="reader" className="w-full h-full"></div>
            </div>
          ) : (
            <div className="w-full relative aspect-square max-w-[280px] bg-slate-900/40 rounded-xl border border-dashed border-slate-800 flex flex-col items-center justify-center text-center p-4">
              <QrCode className="w-12 h-12 text-slate-700 mb-4" />
              <p className="text-xs text-gray-500 mb-4">Scanner is currently paused or inactive.</p>
              <button
                onClick={() => setScannerActive(true)}
                disabled={success}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium px-4 py-2 rounded-lg transition-all flex items-center space-x-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Re-enable Camera</span>
              </button>
            </div>
          )}

          <p className="text-[11px] text-gray-500 mt-4 text-center leading-relaxed">
            Position the QR code label printed on the ESP32 chip inside the camera view finder frame.
          </p>
        </div>

        {/* Right Side: Manual Pair & Help Card */}
        <div className="space-y-6">
          {/* Manual Entry Form */}
          <div className="glass-card rounded-2xl p-6 border border-slate-800/80">
            <div className="flex items-center space-x-2 text-gray-400 mb-6">
              <Cpu className="w-5 h-5 text-blue-400" />
              <span className="text-xs font-semibold uppercase tracking-wider">Manual Association</span>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">Device Model ID</label>
                <input
                  type="text"
                  required
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  placeholder="e.g. LKEQCRDZ or 47392810"
                  className="w-full bg-slate-900/50 border border-slate-700/60 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={loading || success}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <span>Link Device</span>
                )}
              </button>
            </form>
          </div>

          {/* Tester Helper QR */}
          <div className="glass-card rounded-2xl p-5 border border-slate-800/80">
            <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">Testing Simulator Code</h4>
            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              Don't have hardware nearby? Scan this screen using a webcam, or type <code className="bg-slate-900 px-1 py-0.5 rounded text-blue-300 font-mono text-[10px]">ESP32-WATER-001</code> to test the manual input.
            </p>
            <div className="flex items-center space-x-4 bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
              <img 
                src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=ESP32-WATER-001&color=0-149-255&bgcolor=15-23-42" 
                alt="Test MAC ID QR"
                className="w-20 h-20 rounded border border-blue-500/20 bg-slate-950 p-1"
              />
              <div className="text-xs">
                <p className="text-gray-200 font-semibold">Test MAC ID Payload:</p>
                <p className="text-blue-400 font-mono mt-1 text-[11px]">ESP32-WATER-001</p>
                <p className="text-gray-500 text-[10px] mt-1.5">Auto-generates telemetry widgets.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
