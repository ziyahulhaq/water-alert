import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Html5Qrcode } from 'html5-qrcode';
import type { CameraDevice } from 'html5-qrcode';
import {
  Cpu,
  AlertCircle,
  Camera,
  CheckCircle2,
  RefreshCw,
  QrCode,
  FlipHorizontal2,
  SwitchCamera,
} from 'lucide-react';

export default function DevicePairing() {
  const [user, setUser] = useState<any>(null);
  const [macId, setMacId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Camera state
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [activeCameraIndex, setActiveCameraIndex] = useState<number>(0);
  const [scannerRunning, setScannerRunning] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const navigate = useNavigate();
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const isStoppingRef = useRef(false);

  // ── Auth check ──────────────────────────────────────────────────────────────
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

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const stopScanner = useCallback(async () => {
    if (!html5QrcodeRef.current || isStoppingRef.current) return;
    isStoppingRef.current = true;
    try {
      if (html5QrcodeRef.current.isScanning) {
        await html5QrcodeRef.current.stop();
      }
    } catch (e) {
      console.warn('stopScanner error:', e);
    } finally {
      isStoppingRef.current = false;
      setScannerRunning(false);
    }
  }, []);

  const startScanner = useCallback(
    async (cameraId: string) => {
      if (!html5QrcodeRef.current) return;
      setCameraError(null);
      try {
        await html5QrcodeRef.current.start(
          { deviceId: { exact: cameraId } },
          { fps: 10, qrbox: { width: 230, height: 230 } },
          async (decodedText) => {
            const scannedMac = decodedText.trim();
            if (!scannedMac) return;
            await stopScanner();
            setScannerReady(false);
            await handlePairing(scannedMac);
          },
          () => { /* ignore per-frame failures */ }
        );
        setScannerRunning(true);
      } catch (err: any) {
        setCameraError(err?.message ?? 'Could not start camera.');
        setScannerRunning(false);
      }
    },
    [stopScanner] // handlePairing is stable (no deps); declared below
  );

  // ── Initialise cameras on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const instance = new Html5Qrcode('qr-reader');
    html5QrcodeRef.current = instance;
    setScannerReady(true);

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!devices || devices.length === 0) {
          setCameraError('No cameras found on this device.');
          return;
        }
        setCameras(devices);
        // Prefer back camera by default
        const backIdx = devices.findIndex((d) =>
          /back|rear|environment/i.test(d.label)
        );
        const preferred = backIdx >= 0 ? backIdx : 0;
        setActiveCameraIndex(preferred);
        startScanner(devices[preferred].id);
      })
      .catch((err) => {
        setCameraError(err?.message ?? 'Camera permission denied.');
      });

    return () => {
      stopScanner().then(() => {
        instance.clear();
      });
    };
  }, [user]); // startScanner/stopScanner are stable refs

  // ── Switch camera ────────────────────────────────────────────────────────────
  const handleSwitchCamera = async () => {
    if (cameras.length < 2) return;
    await stopScanner();
    const nextIndex = (activeCameraIndex + 1) % cameras.length;
    setActiveCameraIndex(nextIndex);
    // Small delay so the DOM video element resets
    setTimeout(() => startScanner(cameras[nextIndex].id), 200);
  };

  // ── Restart scanner ──────────────────────────────────────────────────────────
  const handleRestartScanner = async () => {
    if (cameras.length === 0) return;
    setError(null);
    setCameraError(null);
    await stopScanner();
    setTimeout(() => startScanner(cameras[activeCameraIndex].id), 200);
  };

  // ── Pairing logic ─────────────────────────────────────────────────────────────
  const handlePairing = async (targetMac: string) => {
    const cleanMac = targetMac.trim();
    if (!cleanMac) {
      setError('Please provide a valid MAC ID');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { data: existingDevices, error: selectError } = await supabase
        .from('devices')
        .select('*')
        .eq('mac_id', cleanMac)
        .then((res: any) => res);

      if (selectError) throw selectError;

      const deviceFound =
        existingDevices && existingDevices.length > 0 ? existingDevices[0] : null;

      if (deviceFound && deviceFound.user_id && deviceFound.user_id !== user.id) {
        throw new Error('This device is already paired with another account.');
      }

      const { error: upsertError } = await supabase.from('devices').upsert({
        ...(deviceFound ? { id: deviceFound.id } : {}),
        mac_id: cleanMac,
        user_id: user.id,
        status: 'online',
        last_seen: new Date().toISOString(),
      });

      if (upsertError) throw upsertError;

      setSuccess(true);
      setTimeout(() => navigate('/notifications'), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to pair device. Please check the MAC ID.');
      // Re-start scanner after error
      setTimeout(() => {
        if (cameras.length > 0) startScanner(cameras[activeCameraIndex].id);
      }, 300);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handlePairing(macId);
  };

  // ── Camera label helpers ──────────────────────────────────────────────────────
  const cameraLabel = (cam: CameraDevice) => {
    const label = cam.label || '';
    if (/back|rear|environment/i.test(label)) return 'Back Camera';
    if (/front|user|face/i.test(label)) return 'Front Camera';
    return label || 'Camera';
  };

  const nextCameraLabel = cameras.length >= 2
    ? cameraLabel(cameras[(activeCameraIndex + 1) % cameras.length])
    : null;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white font-sans">
          Pair Sensor Device
        </h1>
        <p className="text-gray-400 mt-1">
          Scan the QR code on your ESP32 monitor or type its MAC ID manually.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 flex items-start space-x-3 text-red-200 text-sm">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{error}</span>
            <button
              onClick={handleRestartScanner}
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
        {/* ── Left: QR Scanner ── */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800/80 flex flex-col items-center">
          {/* Header */}
          <div className="flex items-center justify-between w-full mb-5">
            <div className="flex items-center space-x-2 text-gray-400">
              <Camera className="w-5 h-5 text-blue-400" />
              <span className="text-xs font-semibold uppercase tracking-wider">QR Code Scanner</span>
            </div>

            {/* Camera badge */}
            {cameras.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full">
                <FlipHorizontal2 className="w-3 h-3" />
                {cameraLabel(cameras[activeCameraIndex])}
              </span>
            )}
          </div>

          {/* Scanner viewport */}
          {!success ? (
            <div className="w-full relative">
              {/* The Html5Qrcode mounts its video feed here */}
              <div
                id="qr-reader"
                className="w-full rounded-xl overflow-hidden border border-slate-700/60 bg-slate-900"
                style={{ minHeight: 260 }}
              />

              {/* Camera error overlay */}
              {cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 rounded-xl p-4 text-center">
                  <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
                  <p className="text-xs text-red-300 mb-4 leading-relaxed">{cameraError}</p>
                  <button
                    onClick={handleRestartScanner}
                    className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium px-4 py-2 rounded-lg transition-all flex items-center space-x-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Camera</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full aspect-square max-w-[280px] bg-slate-900/40 rounded-xl border border-dashed border-slate-800 flex flex-col items-center justify-center text-center p-4">
              <QrCode className="w-12 h-12 text-slate-700 mb-4" />
              <p className="text-xs text-gray-500">Device paired — scanner stopped.</p>
            </div>
          )}

          {/* Controls row */}
          {!success && (
            <div className="mt-4 flex gap-2 w-full">
              {/* Switch camera button */}
              {cameras.length >= 2 && (
                <button
                  onClick={handleSwitchCamera}
                  disabled={!scannerRunning}
                  title={`Switch to ${nextCameraLabel}`}
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700/50 hover:border-blue-500/30 text-white text-xs font-semibold py-2.5 rounded-xl transition-all disabled:opacity-40"
                >
                  <SwitchCamera className="w-4 h-4 text-blue-400" />
                  <span>{nextCameraLabel}</span>
                </button>
              )}

              {/* Restart button */}
              <button
                onClick={handleRestartScanner}
                disabled={!scannerReady}
                title="Restart scanner"
                className="flex items-center justify-center gap-2 bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-gray-400 hover:text-white text-xs font-medium px-3 py-2.5 rounded-xl transition-all disabled:opacity-40"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Restart</span>
              </button>
            </div>
          )}

          <p className="text-[11px] text-gray-500 mt-4 text-center leading-relaxed">
            Position the QR code label on your ESP32 inside the viewfinder.
            {cameras.length >= 2 && (
              <> Use <strong className="text-blue-400">Switch Camera</strong> to toggle front/back.</>
            )}
          </p>
        </div>

        {/* ── Right: Manual + Helper ── */}
        <div className="space-y-6">
          {/* Manual Entry */}
          <div className="glass-card rounded-2xl p-6 border border-slate-800/80">
            <div className="flex items-center space-x-2 text-gray-400 mb-6">
              <Cpu className="w-5 h-5 text-blue-400" />
              <span className="text-xs font-semibold uppercase tracking-wider">Manual Association</span>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">
                  Device MAC ID
                </label>
                <input
                  type="text"
                  required
                  value={macId}
                  onChange={(e) => setMacId(e.target.value)}
                  placeholder="e.g. ESP32-WATER-001 or 3C:61:05:14:97:8A"
                  className="w-full bg-slate-900/50 border border-slate-700/60 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={loading || success}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>Register Device ID</span>
                )}
              </button>
            </form>
          </div>

          {/* Test QR Helper */}
          <div className="glass-card rounded-2xl p-5 border border-slate-800/80">
            <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">
              Testing Simulator Code
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              Don&apos;t have hardware nearby? Scan this QR or type{' '}
              <code className="bg-slate-900 px-1 py-0.5 rounded text-blue-300 font-mono text-[10px]">
                ESP32-WATER-001
              </code>{' '}
              to test with the manual input.
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
