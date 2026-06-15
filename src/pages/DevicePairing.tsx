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
  Bluetooth,
  Wifi,
  Loader2,
  Signal,
  ArrowRight,
  Eye,
  EyeOff,
} from 'lucide-react';

// ── BLE UUIDs (must match ESP32 firmware) ───────────────────────────────
const BLE_SERVICE_UUID    = '12345678-1234-5678-1234-56789abcdef0';
const BLE_CHAR_SSID_UUID  = '12345678-1234-5678-1234-56789abcde01';
const BLE_CHAR_PASS_UUID  = '12345678-1234-5678-1234-56789abcde02';
const BLE_CHAR_MAC_UUID   = '12345678-1234-5678-1234-56789abcde03';
const BLE_CHAR_STATUS_UUID = '12345678-1234-5678-1234-56789abcde04';
const BLE_CHAR_MODEL_UUID = '12345678-1234-5678-1234-56789abcde05';

// ── SHA-256 helper ──────────────────────────────────────────────────────
async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Check Web Bluetooth support ─────────────────────────────────────────
function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

// ── BLE Pairing Steps ───────────────────────────────────────────────────
type BLEStep =
  | 'idle'
  | 'scanning'
  | 'connected'
  | 'wifi-form'
  | 'sending-creds'
  | 'waiting-wifi'
  | 'pairing-db'
  | 'success'
  | 'error';

export default function DevicePairing() {
  const [user, setUser] = useState<any>(null);
  const [modelId, setModelId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Camera state
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [activeCameraIndex, setActiveCameraIndex] = useState<number>(0);
  const [scannerRunning, setScannerRunning] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // BLE state
  const [bleStep, setBleStep] = useState<BLEStep>('idle');
  const [bleDeviceName, setBleDeviceName] = useState<string>('');
  const [bleMac, setBleMac] = useState<string>('');
  const [bleModelId, setBleModelId] = useState<string>('');
  const [wifiSSID, setWifiSSID] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [bleStatus, setBleStatus] = useState<string>('');
  const [bleError, setBleError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ble' | 'qr' | 'manual'>(
    isWebBluetoothSupported() ? 'ble' : 'qr'
  );

  // BLE refs
  const bleServerRef = useRef<BluetoothRemoteGATTServer | null>(null);
  const bleCharStatusRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);

  const navigate = useNavigate();
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const isStoppingRef = useRef(false);
  const handlePairingRef = useRef<((targetId: string) => Promise<void>) | undefined>(undefined);

  // ── Auth check ──────────────────────────────────────────────────────────
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

  // ── Safe camera accessor ────────────────────────────────────────────────
  const getCameraId = useCallback((cams: CameraDevice[], index: number): string | null => {
    if (!cams || cams.length === 0) return null;
    const safeIdx = Math.min(index, cams.length - 1);
    const cam = cams[safeIdx];
    return cam?.id ?? null;
  }, []);

  // ── Scanner Helpers ─────────────────────────────────────────────────────
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
      if (!html5QrcodeRef.current || !cameraId) return;
      setCameraError(null);
      try {
        await html5QrcodeRef.current.start(
          { deviceId: { exact: cameraId } },
          { fps: 10, qrbox: { width: 230, height: 230 } },
          async (decodedText) => {
            const scannedValue = decodedText?.trim();
            console.log('[QR Scanner] Decoded:', JSON.stringify(scannedValue));
            if (!scannedValue) return;
            await stopScanner();
            setScannerReady(false);
            if (handlePairingRef.current) {
              await handlePairingRef.current(scannedValue);
            }
          },
          () => {}
        );
        setScannerRunning(true);
      } catch (err: any) {
        setCameraError(err?.message ?? 'Could not start camera.');
        setScannerRunning(false);
      }
    },
    [stopScanner]
  );

  // ── Initialise cameras when QR tab is active ──────────────────────────
  useEffect(() => {
    if (!user || activeTab !== 'qr') return;

    const readerEl = document.getElementById('qr-reader');
    if (!readerEl) return;

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
        const backIdx = devices.findIndex((d) =>
          /back|rear|environment/i.test(d.label)
        );
        const preferred = backIdx >= 0 ? backIdx : 0;
        setActiveCameraIndex(preferred);
        const camId = devices[preferred]?.id;
        if (camId) startScanner(camId);
        else setCameraError('Selected camera has no valid ID.');
      })
      .catch((err) => {
        setCameraError(err?.message ?? 'Camera permission denied.');
      });

    return () => {
      stopScanner().then(() => {
        instance.clear();
      });
    };
  }, [user, activeTab]);

  // ── Model ID pairing handler ────────────────────────────────────────────
  const handlePairing = async (targetId: string) => {
    let step = 'init';
    try {
      const cleanId = targetId.trim().toUpperCase();
      step = `validate: "${cleanId}"`;
      if (!cleanId) {
        setError('Please provide a valid Model ID');
        return;
      }

      step = 'auth';
      const authResult = await supabase.auth.getUser();
      const freshUser = authResult?.data?.user;
      if (!freshUser || !freshUser.id) {
        setError('You must be logged in to pair a device.');
        navigate('/login');
        return;
      }
      if (!user) setUser(freshUser);
      const currentUserId = freshUser.id;

      setError(null);
      setLoading(true);

      step = `find device: "${cleanId}"`;
      const { data: device, error: findError } = await supabase
        .from('devices')
        .select('id, model_id')
        .ilike('model_id', cleanId)
        .maybeSingle();

      if (findError) throw new Error(`DB error: ${findError.message}`);
      if (!device || !device.id) throw new Error(`Device "${cleanId}" not found. Check the Model ID.`);

      const deviceId = device.id;

      step = 'check existing link';
      const { data: existing } = await supabase
        .from('user_device')
        .select('id, user_id')
        .eq('device_id', deviceId)
        .not('user_id', 'is', null)
        .maybeSingle();

      if (existing && existing.user_id && existing.user_id !== currentUserId) {
        throw new Error('This device is already linked to another account.');
      }

      step = 'link device';
      const { error: linkError } = await supabase
        .from('user_device')
        .upsert(
          { user_id: currentUserId, device_id: deviceId },
          { onConflict: 'user_id,device_id' }
        );

      if (linkError) throw new Error(`Failed to link: ${linkError.message}`);

      step = 'update status';
      await supabase.from('devices').update({
        status: 'online',
        last_seen: new Date().toISOString(),
      }).eq('id', deviceId);

      setSuccess(true);
      setTimeout(() => navigate('/'), 1500);
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error(`[Pairing] Failed at step "${step}":`, err);
      setError(`[${step}] ${msg}`);
      setTimeout(() => {
        setCameras((currentCams) => {
          setActiveCameraIndex((currentIdx) => {
            const camId = getCameraId(currentCams, currentIdx);
            if (camId) startScanner(camId);
            return currentIdx;
          });
          return currentCams;
        });
      }, 500);
    } finally {
      setLoading(false);
    }
  };

  handlePairingRef.current = handlePairing;

  // ════════════════════════════════════════════════════════════════════════
  //  BLE PROVISIONING FLOW
  // ════════════════════════════════════════════════════════════════════════

  const handleBLEScan = async () => {
    setBleError(null);
    setBleStep('scanning');

    try {
      // 1. Request BLE device
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'WaterAlert-' }],
        optionalServices: [BLE_SERVICE_UUID],
      });

      if (!device || !device.gatt) {
        throw new Error('No device selected.');
      }

      setBleDeviceName(device.name || 'WaterAlert Device');
      setBleStep('connected');

      // 2. Connect GATT
      const server = await device.gatt.connect();
      bleServerRef.current = server;

      const service = await server.getPrimaryService(BLE_SERVICE_UUID);

      // 3. Read MAC ID
      const macChar = await service.getCharacteristic(BLE_CHAR_MAC_UUID);
      const macValue = await macChar.readValue();
      const macStr = new TextDecoder().decode(macValue);
      setBleMac(macStr);
      console.log('[BLE] MAC:', macStr);

      // 4. Read Model ID
      try {
        const modelChar = await service.getCharacteristic(BLE_CHAR_MODEL_UUID);
        const modelValue = await modelChar.readValue();
        const modelStr = new TextDecoder().decode(modelValue);
        setBleModelId(modelStr);
        console.log('[BLE] Model:', modelStr);
      } catch {
        console.warn('[BLE] Model ID characteristic not available.');
      }

      // 5. Get status characteristic for notifications
      const statusChar = await service.getCharacteristic(BLE_CHAR_STATUS_UUID);
      bleCharStatusRef.current = statusChar;

      // Subscribe to status notifications
      await statusChar.startNotifications();
      statusChar.addEventListener('characteristicvaluechanged', (event: any) => {
        const status = new TextDecoder().decode(event.target.value);
        console.log('[BLE] Status notification:', status);
        setBleStatus(status);
      });

      // 6. Get write characteristics (keep for later)
      setBleStep('wifi-form');

    } catch (err: any) {
      console.error('[BLE] Error:', err);
      if (err.name === 'NotFoundError') {
        setBleError('No WaterAlert devices found nearby. Make sure the ESP32 is powered on.');
      } else {
        setBleError(err.message || 'BLE connection failed.');
      }
      setBleStep('error');
    }
  };

  const handleSendWiFiCreds = async () => {
    if (!wifiSSID.trim()) {
      setBleError('Please enter your WiFi network name.');
      return;
    }

    setBleError(null);
    setBleStep('sending-creds');

    try {
      const server = bleServerRef.current;
      if (!server || !server.connected) {
        throw new Error('BLE disconnected. Please reconnect.');
      }

      const service = await server.getPrimaryService(BLE_SERVICE_UUID);

      // Write SSID
      const ssidChar = await service.getCharacteristic(BLE_CHAR_SSID_UUID);
      await ssidChar.writeValue(new TextEncoder().encode(wifiSSID.trim()));
      console.log('[BLE] SSID sent:', wifiSSID);

      // Write Password
      const passChar = await service.getCharacteristic(BLE_CHAR_PASS_UUID);
      await passChar.writeValue(new TextEncoder().encode(wifiPassword));
      console.log('[BLE] Password sent');

      setBleStep('waiting-wifi');

      // Wait for WiFi status from ESP32 (via BLE notifications)
      const waitForStatus = (): Promise<string> => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('WiFi connection timeout (30s).')), 35000);

          const checkInterval = setInterval(() => {
            // Check latest bleStatus
            const currentStatus = document.getElementById('ble-status-hidden')?.textContent || '';
            if (currentStatus === 'CONNECTED') {
              clearInterval(checkInterval);
              clearTimeout(timeout);
              resolve('CONNECTED');
            } else if (currentStatus === 'FAILED') {
              clearInterval(checkInterval);
              clearTimeout(timeout);
              reject(new Error('ESP32 failed to connect to WiFi. Check SSID/password.'));
            }
          }, 500);
        });
      };

      await waitForStatus();

      // ── WiFi connected! Now pair in database ──
      setBleStep('pairing-db');

      const authResult = await supabase.auth.getUser();
      const freshUser = authResult?.data?.user;
      if (!freshUser?.id) {
        throw new Error('Not logged in.');
      }

      // Hash MAC for DB lookup
      const macHash = await sha256(bleMac);
      console.log('[BLE] MAC hash:', macHash);

      // Upsert device (in case it doesn't exist yet — first time)
      const { data: upsertedDevice, error: upsertError } = await supabase
        .from('devices')
        .upsert(
          {
            mac_id: bleMac,
            mac_hash: macHash,
            model_id: bleModelId || `WD-${bleMac.replace(/:/g, '').slice(-6)}`,
            status: 'online',
            last_seen: new Date().toISOString(),
          },
          { onConflict: 'mac_hash' }
        )
        .select('id')
        .single();

      if (upsertError) throw new Error(`Device save failed: ${upsertError.message}`);
      if (!upsertedDevice?.id) throw new Error('Failed to get device ID after save.');

      // Link to user
      const { error: linkError } = await supabase
        .from('user_device')
        .upsert(
          { user_id: freshUser.id, device_id: upsertedDevice.id },
          { onConflict: 'user_id,device_id' }
        );

      if (linkError) throw new Error(`Link failed: ${linkError.message}`);

      setBleStep('success');
      setSuccess(true);

      // Disconnect BLE gracefully
      try { server.disconnect(); } catch { /* ok */ }

      setTimeout(() => navigate('/'), 2000);

    } catch (err: any) {
      console.error('[BLE] WiFi provision error:', err);
      setBleError(err.message || 'Failed to provision device.');
      setBleStep('error');
    }
  };

  const handleBLEReset = () => {
    setBleStep('idle');
    setBleError(null);
    setBleStatus('');
    setBleMac('');
    setBleModelId('');
    setWifiSSID('');
    setWifiPassword('');
    try { bleServerRef.current?.disconnect(); } catch { /* ok */ }
  };

  // ── Camera helpers ────────────────────────────────────────────────────
  const handleSwitchCamera = async () => {
    if (cameras.length < 2) return;
    await stopScanner();
    const nextIndex = (activeCameraIndex + 1) % cameras.length;
    setActiveCameraIndex(nextIndex);
    const camId = getCameraId(cameras, nextIndex);
    if (camId) setTimeout(() => startScanner(camId), 200);
  };

  const handleRestartScanner = async () => {
    if (cameras.length === 0) return;
    setError(null);
    setCameraError(null);
    await stopScanner();
    const camId = getCameraId(cameras, activeCameraIndex);
    if (camId) setTimeout(() => startScanner(camId), 200);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handlePairing(modelId);
  };

  const cameraLabel = (cam: CameraDevice) => {
    const label = cam?.label || '';
    if (/back|rear|environment/i.test(label)) return 'Back Camera';
    if (/front|user|face/i.test(label)) return 'Front Camera';
    return label || 'Camera';
  };

  const activeCam = cameras[activeCameraIndex];
  const nextCameraLabel = cameras.length >= 2
    ? cameraLabel(cameras[(activeCameraIndex + 1) % cameras.length])
    : null;

  // ════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Hidden element for BLE status polling */}
      <span id="ble-status-hidden" className="hidden">{bleStatus}</span>

      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Pair Sensor Device</h1>
        <p className="text-gray-400 mt-1">Connect your ESP32 water sensor via Bluetooth, QR code, or Model ID.</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 flex items-start space-x-3 text-red-200 text-sm">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{error}</span>
            <button onClick={handleRestartScanner} className="block mt-2 text-xs text-blue-400 hover:text-blue-300 font-semibold underline">
              Restart Scanner
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-start space-x-3 text-emerald-200 text-sm animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <span>Device paired successfully! Redirecting to Dashboard...</span>
        </div>
      )}

      {/* ── Tab Selector ── */}
      <div className="flex rounded-xl overflow-hidden border border-slate-800/80 bg-slate-900/30">
        {isWebBluetoothSupported() && (
          <button
            onClick={() => setActiveTab('ble')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold uppercase tracking-wider transition-all ${
              activeTab === 'ble'
                ? 'bg-blue-600/20 text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Bluetooth className="w-4 h-4" />
            Bluetooth
          </button>
        )}
        <button
          onClick={() => setActiveTab('qr')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold uppercase tracking-wider transition-all ${
            activeTab === 'qr'
              ? 'bg-blue-600/20 text-blue-400 border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <Camera className="w-4 h-4" />
          QR Code
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold uppercase tracking-wider transition-all ${
            activeTab === 'manual'
              ? 'bg-blue-600/20 text-blue-400 border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <Cpu className="w-4 h-4" />
          Model ID
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/*  BLE TAB                                                           */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'ble' && (
        <div className="glass-card rounded-2xl p-6 border border-slate-800/80 space-y-6">
          <div className="flex items-center space-x-3 text-gray-400">
            <Bluetooth className="w-5 h-5 text-blue-400" />
            <span className="text-xs font-semibold uppercase tracking-wider">Bluetooth Provisioning</span>
          </div>

          {/* Step: idle — show scan button */}
          {bleStep === 'idle' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-blue-500/10 rounded-2xl border border-blue-500/20 flex items-center justify-center">
                <Bluetooth className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Connect via Bluetooth</h3>
                <p className="text-gray-400 text-sm mt-1 max-w-sm mx-auto">
                  Make sure your ESP32 is powered on and showing "BLE Ready" on its LCD.
                </p>
              </div>
              <button
                onClick={handleBLEScan}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3 rounded-xl transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 flex items-center justify-center gap-2 mx-auto"
              >
                <Signal className="w-5 h-5" />
                Scan for Devices
              </button>
            </div>
          )}

          {/* Step: scanning */}
          {bleStep === 'scanning' && (
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 text-blue-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-300 text-sm">Scanning for WaterAlert devices...</p>
              <p className="text-gray-500 text-xs mt-1">Select your device from the browser popup.</p>
            </div>
          )}

          {/* Step: connected / wifi-form — show WiFi input */}
          {(bleStep === 'connected' || bleStep === 'wifi-form') && (
            <div className="space-y-5">
              {/* Device info card */}
              <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-emerald-300 font-semibold text-sm">Connected: {bleDeviceName}</p>
                  <p className="text-gray-400 text-xs font-mono mt-0.5">MAC: {bleMac}</p>
                  {bleModelId && <p className="text-gray-400 text-xs font-mono">Model: {bleModelId}</p>}
                </div>
              </div>

              {/* WiFi credential form */}
              <div>
                <h4 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-blue-400" />
                  Enter Your WiFi Credentials
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-gray-300 text-xs font-semibold uppercase tracking-wider mb-1.5">WiFi Network Name (SSID)</label>
                    <input
                      type="text"
                      value={wifiSSID}
                      onChange={(e) => setWifiSSID(e.target.value)}
                      placeholder="e.g. MyHomeWiFi"
                      className="w-full bg-slate-900/50 border border-slate-700/60 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 text-xs font-semibold uppercase tracking-wider mb-1.5">WiFi Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={wifiPassword}
                        onChange={(e) => setWifiPassword(e.target.value)}
                        placeholder="Enter WiFi password"
                        className="w-full bg-slate-900/50 border border-slate-700/60 rounded-xl py-3 px-4 pr-12 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={handleSendWiFiCreds}
                    disabled={!wifiSSID.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowRight className="w-4 h-4" />
                    Send WiFi & Pair Device
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step: sending-creds */}
          {bleStep === 'sending-creds' && (
            <div className="text-center py-6">
              <Loader2 className="w-10 h-10 text-blue-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-300 text-sm">Sending WiFi credentials to ESP32...</p>
            </div>
          )}

          {/* Step: waiting-wifi */}
          {bleStep === 'waiting-wifi' && (
            <div className="text-center py-6">
              <Wifi className="w-10 h-10 text-blue-400 animate-pulse mx-auto mb-4" />
              <p className="text-gray-300 text-sm">ESP32 is connecting to WiFi...</p>
              <p className="text-gray-500 text-xs mt-1">This may take up to 30 seconds.</p>
              {bleStatus && <p className="text-blue-400 text-xs font-mono mt-2">Status: {bleStatus}</p>}
            </div>
          )}

          {/* Step: pairing-db */}
          {bleStep === 'pairing-db' && (
            <div className="text-center py-6">
              <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-300 text-sm">WiFi connected! Registering device...</p>
            </div>
          )}

          {/* Step: success */}
          {bleStep === 'success' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-emerald-400">Device Paired Successfully!</h3>
              <p className="text-gray-400 text-sm mt-1">WiFi configured and device linked. Redirecting...</p>
            </div>
          )}

          {/* Step: error */}
          {bleStep === 'error' && (
            <div className="space-y-4">
              <div className="bg-red-950/30 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-300 text-sm">{bleError}</p>
                </div>
              </div>
              <button
                onClick={handleBLEReset}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/*  QR TAB                                                            */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'qr' && (
        <div className="glass-card rounded-2xl p-6 border border-slate-800/80 flex flex-col items-center">
          <div className="flex items-center justify-between w-full mb-5">
            <div className="flex items-center space-x-2 text-gray-400">
              <Camera className="w-5 h-5 text-blue-400" />
              <span className="text-xs font-semibold uppercase tracking-wider">QR Code Scanner</span>
            </div>
            {activeCam && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full">
                <FlipHorizontal2 className="w-3 h-3" />
                {cameraLabel(activeCam)}
              </span>
            )}
          </div>

          {!success ? (
            <div className="w-full relative">
              <div id="qr-reader" className="w-full rounded-xl overflow-hidden border border-slate-700/60 bg-slate-900" style={{ minHeight: 260 }} />
              {cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 rounded-xl p-4 text-center">
                  <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
                  <p className="text-xs text-red-300 mb-4 leading-relaxed">{cameraError}</p>
                  <button onClick={handleRestartScanner} className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium px-4 py-2 rounded-lg transition-all flex items-center space-x-1.5">
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

          {!success && (
            <div className="mt-4 flex gap-2 w-full">
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
          </p>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/*  MANUAL TAB                                                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'manual' && (
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
                placeholder="e.g. WD828B9C or ESP32-WATER-001"
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
                <span>Link Device</span>
              )}
            </button>
          </form>

          {/* Test QR Helper */}
          <div className="mt-6 bg-slate-900/40 rounded-xl p-4 border border-slate-800/60">
            <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">Test Code</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Don&apos;t have hardware? Type{' '}
              <code className="bg-slate-900 px-1.5 py-0.5 rounded text-blue-300 font-mono text-[10px]">ESP32-WATER-001</code>{' '}
              above to test.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
