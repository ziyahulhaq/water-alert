// ─── Device Pairing Screen ───────────────────────────────────────────────────
// 3-tab layout: Bluetooth (BLE), QR Code Scanner, Manual Input

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { TabSelector } from '@/components/ui/tab-selector';
import { GlassCard } from '@/components/ui/glass-card';
import { GradientButton } from '@/components/ui/gradient-button';
import { InputField } from '@/components/ui/input-field';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/storage-client';
import { hashMacAddress } from '@/lib/hash';
import { AppColors, BorderRadius, FontSizes, Spacing } from '@/constants/theme';

// ─── Tab Configuration ───────────────────────────────────────────────────────

const TABS = [
  { key: 'ble', label: 'Bluetooth', icon: '📶' },
  { key: 'qr', label: 'QR Code', icon: '📷' },
  { key: 'manual', label: 'Manual', icon: '✏️' },
];

export default function PairDeviceScreen() {
  const [activeTab, setActiveTab] = useState('ble');

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <TabSelector tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      </View>

      {activeTab === 'ble' && <BLETab />}
      {activeTab === 'qr' && <QRTab />}
      {activeTab === 'manual' && <ManualTab />}
    </View>
  );
}

// ─── BLE Tab ─────────────────────────────────────────────────────────────────

interface BLEDevice {
  id: string;
  name: string;
  rssi: number;
}

// ─── BLE Tab ─────────────────────────────────────────────────────────────────

import { BleManager, Device as BlePeripheral } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { PermissionsAndroid, Platform } from 'react-native';
import { BLE_DEVICE_PREFIX, BLE_SERVICE_UUID, BLE_CHARACTERISTICS, BLE_STATUS_CONNECTED } from '@/lib/ble-constants';

interface BLEDevice {
  id: string;
  name: string;
  rssi: number;
}

// Safe instantiation of BleManager to prevent crashing in Expo Go / Simulator
let manager: BleManager | null = null;
try {
  manager = new BleManager();
} catch (e) {
  console.warn(
    'BLE Manager could not be initialized (common in Expo Go). Falling back to simulation mode.',
    e
  );
}

async function requestBluetoothPermissions(): Promise<boolean> {
  if (!manager) return false;
  if (Platform.OS === 'ios') {
    return true;
  }

  if (Platform.OS === 'android') {
    const apiLevel = Platform.Version as number;

    if (apiLevel < 31) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'Smart Water Alert needs location permission to scan for nearby devices.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } else {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return (
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED &&
        result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED
      );
    }
  }

  return false;
}

function BLETab() {
  const { user } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<BLEDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<BLEDevice | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [wifiSSID, setWifiSSID] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [status, setStatus] = useState<string>('');

  const isMockBLE = !manager;

  const handleScan = useCallback(async () => {
    setDevices([]);

    if (isMockBLE) {
      setScanning(true);
      setStatus('Scanning (Simulation Mode)...');
      try {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const mockDevices: BLEDevice[] = [
          { id: 'mock-ble-1', name: 'WaterAlert-A3F2', rssi: -45 },
          { id: 'mock-ble-2', name: 'WaterAlert-B7C1', rssi: -62 },
        ];
        setDevices(mockDevices);
        setStatus(`Found ${mockDevices.length} device(s)`);
      } catch {
        setStatus('Scan failed.');
      } finally {
        setScanning(false);
      }
      return;
    }

    const hasPermission = await requestBluetoothPermissions();
    if (!hasPermission) {
      setStatus('Permission denied. Cannot scan.');
      Alert.alert('Permission Denied', 'Please grant Bluetooth and location permissions to scan.');
      return;
    }

    setScanning(true);
    setStatus('Scanning for nearby devices...');

    // Stop existing scans if any
    manager!.stopDeviceScan();

    manager!.startDeviceScan(
      [BLE_SERVICE_UUID],
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          console.error(error);
          setStatus('Scan failed: ' + error.message);
          setScanning(false);
          return;
        }

        if (device && device.name && device.name.startsWith(BLE_DEVICE_PREFIX)) {
          setDevices((prev) => {
            const exists = prev.some((d) => d.id === device.id);
            if (exists) return prev;
            return [
              ...prev,
              {
                id: device.id,
                name: device.name ?? 'Unknown Device',
                rssi: device.rssi ?? 0,
              },
            ];
          });
        }
      }
    );

    // Timeout scanning after 10 seconds
    setTimeout(() => {
      if (manager) manager.stopDeviceScan();
      setScanning(false);
      setStatus((s) => (s.startsWith('Scanning') ? 'Scan complete.' : s));
    }, 10000);
  }, [isMockBLE]);

  const handleConnect = useCallback(async () => {
    if (!selectedDevice) return;
    if (!wifiSSID.trim()) {
      Alert.alert('Error', 'Please enter the WiFi SSID');
      return;
    }

    setConnecting(true);
    setStatus('Connecting to device...');

    if (isMockBLE) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setStatus('Writing WiFi configuration (Simulation)...');
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setStatus('Waiting for device WiFi connection...');
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Insert mock device connection
        setStatus('Linking device to account...');
        await linkDeviceByModelId('WD-A3F2B7', user?.id ?? '');

        setStatus('✅ Device paired successfully!');
        Alert.alert('Success', 'Device has been paired and connected to WiFi!');
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to link device');
      } finally {
        setConnecting(false);
      }
      return;
    }

    manager!.stopDeviceScan();

    try {
      // 1. Connect to peripheral
      const device = await manager!.connectToDevice(selectedDevice.id);
      setStatus('Connected. Discovering services...');

      // 2. Discover services and characteristics
      await device.discoverAllServicesAndCharacteristics();
      setStatus('Writing WiFi configuration...');

      // 3. Encode SSID and password to Base64
      const b64SSID = Buffer.from(wifiSSID).toString('base64');
      const b64Password = Buffer.from(wifiPassword).toString('base64');

      // 4. Write characteristics
      await device.writeCharacteristicWithResponseForService(
        BLE_SERVICE_UUID,
        BLE_CHARACTERISTICS.SSID,
        b64SSID
      );
      await device.writeCharacteristicWithResponseForService(
        BLE_SERVICE_UUID,
        BLE_CHARACTERISTICS.PASSWORD,
        b64Password
      );

      // 5. Read MAC address and Model ID from device
      setStatus('Retrieving device details...');
      const macChar = await device.readCharacteristicForService(
        BLE_SERVICE_UUID,
        BLE_CHARACTERISTICS.MAC_ADDRESS
      );
      const modelChar = await device.readCharacteristicForService(
        BLE_SERVICE_UUID,
        BLE_CHARACTERISTICS.MODEL_ID
      );

      const mac = macChar.value ? Buffer.from(macChar.value, 'base64').toString('ascii') : '';
      const modelId = modelChar.value ? Buffer.from(modelChar.value, 'base64').toString('ascii') : '';

      if (!mac || !modelId) {
        throw new Error('Failed to retrieve MAC or Model ID from device.');
      }

      // 6. Monitor Connection status characteristic
      setStatus('Waiting for device WiFi connection...');
      let isConfigured = false;

      const statusSubscription = device.monitorCharacteristicForService(
        BLE_SERVICE_UUID,
        BLE_CHARACTERISTICS.STATUS,
        async (err, char) => {
          if (err) {
            console.error('Monitoring error:', err);
            return;
          }
          if (char?.value) {
            const currentStatus = Buffer.from(char.value, 'base64').toString('ascii');
            if (currentStatus === BLE_STATUS_CONNECTED) {
              isConfigured = true;
              statusSubscription.remove();

              // Pair device in Supabase / Local Storage
              setStatus('Linking device to account...');
              try {
                await linkDeviceByModelId(modelId, user?.id ?? '');
                setStatus('✅ Device paired successfully!');
                Alert.alert('Success', 'Device has been paired and connected to WiFi!');
              } catch (linkErr) {
                Alert.alert('Error', linkErr instanceof Error ? linkErr.message : 'Failed to link device');
              } finally {
                setConnecting(false);
              }
            }
          }
        }
      );

      // 30 seconds timeout
      setTimeout(() => {
        if (!isConfigured) {
          statusSubscription.remove();
          setStatus('WiFi connection timed out.');
          Alert.alert('Timeout', 'Device failed to connect to WiFi in time. Check network credentials.');
          setConnecting(false);
        }
      }, 30000);

    } catch (err) {
      console.error(err);
      setStatus('Connection or setup failed');
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to connect to device');
      setConnecting(false);
    }
  }, [selectedDevice, wifiSSID, wifiPassword, isMockBLE, user]);

  return (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.tabScrollContent}
      showsVerticalScrollIndicator={false}>
      {/* Simulation Banner Notice */}
      {isMockBLE && (
        <GlassCard compact glowColor={AppColors.amber}>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>ℹ️</Text>
            <Text style={styles.infoText}>
              Running in **Simulation Mode** (Expo Go detected). Real Bluetooth pairing requires a custom development build.
            </Text>
          </View>
        </GlassCard>
      )}

      {/* Scan Button */}
      <GradientButton
        title={scanning ? 'Scanning...' : 'Scan for Devices'}
        icon="📶"
        onPress={handleScan}
        loading={scanning}
        style={styles.scanButton}
      />

      {/* Status */}
      {status !== '' && (
        <Text style={styles.statusText}>{status}</Text>
      )}

      {/* Device List */}
      {devices.length > 0 && (
        <GlassCard>
          <Text style={styles.listTitle}>Nearby Devices</Text>
          {devices.map((device) => (
            <TouchableOpacity
              key={device.id}
              style={[
                styles.deviceItem,
                selectedDevice?.id === device.id && styles.deviceItemSelected,
              ]}
              onPress={() => setSelectedDevice(device)}
              activeOpacity={0.7}>
              <View style={styles.deviceLeft}>
                <Text style={styles.deviceIcon}>📡</Text>
                <View>
                  <Text style={styles.deviceName}>{device.name}</Text>
                  <Text style={styles.deviceRssi}>
                    Signal: {device.rssi} dBm
                  </Text>
                </View>
              </View>
              {selectedDevice?.id === device.id && (
                <StatusBadge label="Selected" color={AppColors.emerald} size="sm" />
              )}
            </TouchableOpacity>
          ))}
        </GlassCard>
      )}

      {/* WiFi Credentials Form */}
      {selectedDevice && (
        <GlassCard>
          <Text style={styles.listTitle}>WiFi Configuration</Text>
          <InputField
            label="WiFi Network (SSID)"
            icon="📶"
            placeholder="Enter WiFi name"
            value={wifiSSID}
            onChangeText={setWifiSSID}
          />
          <InputField
            label="WiFi Password"
            icon="🔑"
            placeholder="Enter WiFi password"
            value={wifiPassword}
            onChangeText={setWifiPassword}
            secureTextEntry
          />
          <GradientButton
            title="Connect & Pair"
            icon="🔗"
            onPress={handleConnect}
            loading={connecting}
            colors={['#059669', '#10B981']}
          />
        </GlassCard>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

// ─── QR Code Tab ─────────────────────────────────────────────────────────────

function QRTab() {
  const router = useRouter();
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleBarCodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (scanned || processing) return;
      setScanned(true);
      setProcessing(true);

      try {
        const modelId = data.trim();
        if (!modelId) {
          Alert.alert('Invalid QR', 'No Model ID found in the QR code.');
          setScanned(false);
          setProcessing(false);
          return;
        }

        // Link device by model ID
        await linkDeviceByModelId(modelId, user?.id ?? '');

        Alert.alert('Success', `Device ${modelId} has been linked!`, [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } catch (error) {
        Alert.alert(
          'Error',
          error instanceof Error ? error.message : 'Failed to link device'
        );
        setScanned(false);
      } finally {
        setProcessing(false);
      }
    },
    [scanned, processing, user, router]
  );

  if (!permission) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color={AppColors.accentBlue} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContent}>
        <Text style={styles.permissionIcon}>📷</Text>
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>
          We need camera permission to scan QR codes on your device
        </Text>
        <GradientButton
          title="Grant Permission"
          icon="✅"
          onPress={requestPermission}
          style={styles.permissionButton}
        />
      </View>
    );
  }

  return (
    <View style={styles.qrContainer}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay */}
      <View style={styles.qrOverlay}>
        <View style={styles.qrFrame}>
          <View style={[styles.qrCorner, styles.qrCornerTL]} />
          <View style={[styles.qrCorner, styles.qrCornerTR]} />
          <View style={[styles.qrCorner, styles.qrCornerBL]} />
          <View style={[styles.qrCorner, styles.qrCornerBR]} />
        </View>
        <Text style={styles.qrHint}>
          {processing ? 'Processing...' : 'Point camera at device QR code'}
        </Text>
      </View>

      {scanned && !processing && (
        <TouchableOpacity
          style={styles.rescanButton}
          onPress={() => setScanned(false)}>
          <Text style={styles.rescanText}>Tap to scan again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Manual Input Tab ────────────────────────────────────────────────────────

function ManualTab() {
  const router = useRouter();
  const { user } = useAuth();
  const [modelId, setModelId] = useState('');
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLink = useCallback(async () => {
    setError(null);

    if (!modelId.trim()) {
      setError('Please enter a Model ID');
      return;
    }

    if (modelId.trim().length < 4) {
      setError('Model ID must be at least 4 characters');
      return;
    }

    setLinking(true);
    try {
      await linkDeviceByModelId(modelId.trim(), user?.id ?? '');
      Alert.alert('Success', `Device ${modelId.trim()} has been linked!`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link device');
    } finally {
      setLinking(false);
    }
  }, [modelId, user, router]);

  return (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.tabScrollContent}
      showsVerticalScrollIndicator={false}>
      <GlassCard>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>✏️</Text>
          <Text style={styles.sectionTitle}>Enter Model ID</Text>
        </View>
        <Text style={styles.sectionDesc}>
          Find the Model ID on the sticker on your device (e.g., WD-8B9C0A)
        </Text>

        <InputField
          label="Device Model ID"
          icon="🏷️"
          placeholder="WD-XXXXXX"
          value={modelId}
          onChangeText={setModelId}
          autoCapitalize="characters"
          error={error}
        />

        <GradientButton
          title="Link Device"
          icon="🔗"
          onPress={handleLink}
          loading={linking}
          colors={['#059669', '#10B981']}
        />
      </GlassCard>

      {/* Help Info */}
      <GlassCard compact>
        <Text style={styles.helpTitle}>Where to find the Model ID?</Text>
        <View style={styles.helpItem}>
          <Text style={styles.helpBullet}>•</Text>
          <Text style={styles.helpText}>
            Check the sticker on the back of your Smart Water Alert device
          </Text>
        </View>
        <View style={styles.helpItem}>
          <Text style={styles.helpBullet}>•</Text>
          <Text style={styles.helpText}>
            Format: WD- followed by 6 alphanumeric characters
          </Text>
        </View>
        <View style={styles.helpItem}>
          <Text style={styles.helpBullet}>•</Text>
          <Text style={styles.helpText}>
            Each device can be linked by up to 2 users
          </Text>
        </View>
      </GlassCard>
    </ScrollView>
  );
}

// ─── Shared: Link Device by Model ID ─────────────────────────────────────────

async function linkDeviceByModelId(modelId: string, userId: string) {
  if (!userId) throw new Error('Not authenticated');

  // 1. Find device by model_id
  const { data: device, error: deviceError } = await db
    .from('devices')
    .select('*')
    .eq('model_id', modelId)
    .maybeSingle();

  if (deviceError) throw new Error(deviceError.message);
  if (!device) throw new Error(`No device found with Model ID: ${modelId}`);

  // 2. Check linked user count (max 2)
  const { data: existingLinks } = await db
    .from('user_device')
    .select('*')
    .eq('device_id', device.id);

  if (existingLinks && existingLinks.length >= 2) {
    throw new Error('This device already has the maximum number of linked users (2)');
  }

  // 3. Check if already linked to this user
  const alreadyLinked = existingLinks?.find(
    (link: { user_id: string }) => link.user_id === userId
  );
  if (alreadyLinked) {
    throw new Error('This device is already linked to your account');
  }

  // 4. Create link
  const { error: linkError } = await db.from('user_device').insert({
    user_id: userId,
    device_id: device.id,
  });

  if (linkError) throw new Error(linkError.message);
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.bgPrimary,
  },
  tabContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  tabContent: {
    flex: 1,
  },
  tabScrollContent: {
    padding: Spacing.lg,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['2xl'],
    gap: Spacing.md,
  },
  bottomSpacer: {
    height: Spacing['3xl'],
  },

  // BLE Tab
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  infoIcon: {
    fontSize: 16,
  },
  infoText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: AppColors.amber,
    lineHeight: 18,
  },
  scanButton: {
    marginBottom: Spacing.lg,
  },
  statusText: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  listTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: AppColors.textPrimary,
    marginBottom: Spacing.md,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: AppColors.bgSecondary,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: AppColors.bgCardBorder,
  },
  deviceItemSelected: {
    borderColor: AppColors.emerald + '60',
    backgroundColor: AppColors.emerald + '10',
  },
  deviceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  deviceIcon: {
    fontSize: 24,
  },
  deviceName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: AppColors.textPrimary,
  },
  deviceRssi: {
    fontSize: FontSizes.xs,
    color: AppColors.textMuted,
  },

  // QR Tab
  qrContainer: {
    flex: 1,
    position: 'relative',
  },
  qrOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrFrame: {
    width: 240,
    height: 240,
    position: 'relative',
  },
  qrCorner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: AppColors.accentBlue,
  },
  qrCornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  qrCornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  qrCornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  qrCornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  qrHint: {
    marginTop: Spacing['3xl'],
    fontSize: FontSizes.md,
    color: AppColors.white,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  rescanButton: {
    position: 'absolute',
    bottom: Spacing['5xl'],
    alignSelf: 'center',
    backgroundColor: AppColors.accentBlue,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
  },
  rescanText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: AppColors.white,
  },

  // Permission screen
  permissionIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  permissionTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: AppColors.textPrimary,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: FontSizes.sm,
    color: AppColors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  permissionButton: {
    marginTop: Spacing.lg,
    width: '100%',
  },

  // Manual Tab
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sectionIcon: {
    fontSize: 20,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  sectionDesc: {
    fontSize: FontSizes.sm,
    color: AppColors.textMuted,
    marginBottom: Spacing.xl,
    lineHeight: 18,
  },
  helpTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: AppColors.textPrimary,
    marginBottom: Spacing.md,
  },
  helpItem: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  helpBullet: {
    color: AppColors.accentBlue,
    fontWeight: '700',
  },
  helpText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
    lineHeight: 18,
  },
});
