// ─── Device Pairing Screen ───────────────────────────────────────────────────
// 2-tab layout matching mockup: Bluetooth (BLE) and QR Code Scanner

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { GlassCard } from '@/components/ui/glass-card';
import { GradientButton } from '@/components/ui/gradient-button';
import { InputField } from '@/components/ui/input-field';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/storage-client';
import { useTheme } from '@/theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, BorderRadius, FontSizes, Spacing } from '@/constants/theme';

export default function PairDeviceScreen() {
  const [activeTab, setActiveTab] = useState('ble');
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Custom Mockup Header */}
      <View style={[
        styles.customHeader, 
        { 
          height: 52 + insets.top, 
          paddingTop: insets.top, 
          backgroundColor: colors.bg, 
          borderBottomColor: colors.frame 
        }
      ]}>
        <Text style={[styles.customHeaderTitle, { color: colors.t1 }]}>ADD DEVICE</Text>
      </View>

      {/* Mockup Tabs */}
      <View style={[styles.customTabBar, { borderBottomColor: colors.frame }]}>
        <TouchableOpacity 
          style={[styles.customTab, activeTab === 'ble' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]} 
          onPress={() => setActiveTab('ble')}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.customTabText, 
            { color: activeTab === 'ble' ? colors.t1 : colors.t3 },
            activeTab === 'ble' && { fontFamily: 'Poppins_600SemiBold' }
          ]}>
            Bluetooth
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.customTab, activeTab === 'qr' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]} 
          onPress={() => setActiveTab('qr')}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.customTabText, 
            { color: activeTab === 'qr' ? colors.t1 : colors.t3 },
            activeTab === 'qr' && { fontFamily: 'Poppins_600SemiBold' }
          ]}>
            QR Code
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'ble' && <BLETab />}
      {activeTab === 'qr' && <QRTab />}
    </View>
  );
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

const ScanningRing = ({ delay, color }: { delay: number; color: string }) => {
  const scale = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const runAnimation = () => {
      scale.setValue(0.3);
      opacity.setValue(0.7);
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1.0,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]).start(() => runAnimation());
    };

    const t = setTimeout(runAnimation, delay);
    return () => clearTimeout(t);
  }, [scale, opacity, delay]);

  return (
    <Animated.View
      style={[
        styles.scanningRing,
        {
          borderColor: color,
          opacity: opacity,
          transform: [{ scale: scale }],
        },
      ]}
    />
  );
};

function BLETab() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<BLEDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<BLEDevice | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [wifiSSID, setWifiSSID] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [status, setStatus] = useState<string>('');

  const [wifiNetworks, setWifiNetworks] = useState<string[]>([]);
  const [bleMac, setBleMac] = useState<string>('');
  const [bleModelId, setBleModelId] = useState<string>('');
  const [connectedDevice, setConnectedDevice] = useState<any>(null);

  const [ssidFocused, setSsidFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

  const isMockBLE = !manager;

  useEffect(() => {
    return () => {
      if (connectedDevice) {
        connectedDevice.cancelConnection().catch(() => {});
      }
    };
  }, [connectedDevice]);

  const handleScan = useCallback(async () => {
    setDevices([]);
    setSelectedDevice(null);
    setWifiNetworks([]);
    setConnectedDevice(null);

    if (isMockBLE) {
      setScanning(true);
      setStatus('Scanning (Simulation Mode)...');
      try {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const mockDevices: BLEDevice[] = [
          { id: 'mock-ble-1', name: 'WaterAlert-8B9C', rssi: -50 },
        ];
        setDevices(mockDevices);
        setStatus('Scan complete.');
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

  useEffect(() => {
    handleScan();
    return () => {
      if (manager) manager.stopDeviceScan();
    };
  }, [handleScan]);

  const handleSelectDevice = async (device: BLEDevice) => {
    setSelectedDevice(device);
    setConnecting(true);
    setStatus('Connecting to device...');

    if (isMockBLE) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setWifiNetworks(['MyHomeWiFi_5G', 'Municipal_Water_Alert', 'GuestNet', 'Office_WiFi']);
        setBleMac('AA:BB:CC:DD:EE:FF');
        setBleModelId('WD-A3F2B7');
        setStatus('Connected to ' + device.name);
      } catch (err) {
        console.error(err);
      } finally {
        setConnecting(false);
      }
      return;
    }

    manager!.stopDeviceScan();

    try {
      const connected = await manager!.connectToDevice(device.id);
      setConnectedDevice(connected);
      setStatus('Discovering services...');
      await connected.discoverAllServicesAndCharacteristics();
      
      setStatus('Retrieving device configuration...');

      const macChar = await connected.readCharacteristicForService(
        BLE_SERVICE_UUID,
        BLE_CHARACTERISTICS.MAC_ADDRESS
      );
      const mac = macChar.value ? Buffer.from(macChar.value, 'base64').toString('ascii') : '';
      setBleMac(mac);

      const modelChar = await connected.readCharacteristicForService(
        BLE_SERVICE_UUID,
        BLE_CHARACTERISTICS.MODEL_ID
      );
      const model = modelChar.value ? Buffer.from(modelChar.value, 'base64').toString('ascii') : '';
      setBleModelId(model);

      try {
        const wifiListChar = await connected.readCharacteristicForService(
          BLE_SERVICE_UUID,
          BLE_CHARACTERISTICS.WIFI_SCAN_LIST
        );
        const wifiListStr = wifiListChar.value ? Buffer.from(wifiListChar.value, 'base64').toString('ascii') : '';
        console.log('[BLE] WiFi networks:', wifiListStr);
        if (wifiListStr.trim()) {
          const networks = wifiListStr.split('\n').filter((s: string) => s.trim().length > 0);
          setWifiNetworks(networks);
        }
      } catch (wifiErr) {
        console.warn('[BLE] WiFi list characteristic read failed:', wifiErr);
      }

      setStatus('Connected to ' + device.name);
    } catch (err: any) {
      console.error('[BLE] Select device failed:', err);
      Alert.alert('Connection Failed', err.message || 'Failed to connect to device');
      setSelectedDevice(null);
      setStatus('');
    } finally {
      setConnecting(false);
    }
  };

  const handleConnect = useCallback(async () => {
    if (!wifiSSID.trim()) {
      Alert.alert('Error', 'Please select or enter a WiFi SSID');
      return;
    }

    setConnecting(true);
    setStatus('Writing WiFi configuration...');

    if (isMockBLE) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setStatus('Waiting for device WiFi connection...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
        setStatus('Linking device to account...');
        await linkDeviceByModelId('WD-A3F2B7', user?.id ?? '');
        setStatus('✅ Device paired successfully!');
        Alert.alert('Success', 'Device has been paired and connected to WiFi!', [
          { text: 'OK', onPress: () => router.replace('/(tabs)') }
        ]);
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to link device');
      } finally {
        setConnecting(false);
      }
      return;
    }

    try {
      if (!connectedDevice) {
        throw new Error('Device is not connected. Please re-select the device.');
      }

      const b64SSID = Buffer.from(wifiSSID.trim()).toString('base64');
      const b64Password = Buffer.from(wifiPassword).toString('base64');

      await connectedDevice.writeCharacteristicWithResponseForService(
        BLE_SERVICE_UUID,
        BLE_CHARACTERISTICS.SSID,
        b64SSID
      );
      await connectedDevice.writeCharacteristicWithResponseForService(
        BLE_SERVICE_UUID,
        BLE_CHARACTERISTICS.PASSWORD,
        b64Password
      );

      setStatus('WiFi credentials sent. Waiting for connection...');
      let isConfigured = false;

      const statusSubscription = connectedDevice.monitorCharacteristicForService(
        BLE_SERVICE_UUID,
        BLE_CHARACTERISTICS.STATUS,
        async (err: any, char: any) => {
          if (err) {
            console.error('Monitoring error:', err);
            return;
          }
          if (char?.value) {
            const currentStatus = Buffer.from(char.value, 'base64').toString('ascii');
            if (currentStatus === BLE_STATUS_CONNECTED) {
              isConfigured = true;
              statusSubscription.remove();

              setStatus('Linking device to account...');
              try {
                const targetModelId = bleModelId || `WD-${bleMac.replace(/:/g, '').slice(-6)}`;
                await linkDeviceByModelId(targetModelId, user?.id ?? '');
                setStatus('✅ Device paired successfully!');
                Alert.alert('Success', 'Device has been paired and connected to WiFi!', [
                  { text: 'OK', onPress: () => router.replace('/(tabs)') }
                ]);
              } catch (linkErr) {
                Alert.alert('Error', linkErr instanceof Error ? linkErr.message : 'Failed to link device');
              } finally {
                setConnecting(false);
              }
            }
          }
        }
      );

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
      setStatus('WiFi configuration failed');
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to configure WiFi');
      setConnecting(false);
    }
  }, [connectedDevice, wifiSSID, wifiPassword, isMockBLE, user, bleModelId, bleMac]);

  return (
    <ScrollView
      style={[styles.tabContent, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.tabScrollContent}
      showsVerticalScrollIndicator={false}>
      {isMockBLE && scanning && (
        <View style={[styles.infoBanner, { backgroundColor: colors.surface, borderColor: colors.hair }]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoIcon, { color: colors.alert }]}>ℹ️</Text>
            <Text style={[styles.infoText, { color: colors.t2 }]}>
              Running in Simulation Mode (Expo Go detected). Real Bluetooth pairing requires a custom development build.
            </Text>
          </View>
        </View>
      )}

      {scanning && (
        <View style={styles.scanningContainer}>
          <View style={styles.ringsContainer}>
            <ScanningRing delay={0} color={colors.accent} />
            <ScanningRing delay={670} color={colors.accent} />
            <ScanningRing delay={1340} color={colors.accent} />
            <View style={[styles.centerBluetoothCircle, { backgroundColor: colors.surface, borderColor: colors.hair }]}>
              <Ionicons name="bluetooth" size={26} color={colors.accent} />
            </View>
          </View>
          <Text style={[styles.scanningText, { color: colors.t3 }]}>Scanning for nearby devices...</Text>
        </View>
      )}

      {!scanning && devices.length > 0 && !selectedDevice && (
        <View style={styles.foundContainer}>
          <View style={[styles.centerBluetoothCircle, { alignSelf: 'center', marginBottom: 36, backgroundColor: colors.surface, borderColor: colors.hair }]}>
            <Ionicons name="bluetooth" size={26} color={colors.accent} />
          </View>
          
          <Text style={[styles.foundLabel, { color: colors.t3 }]}>Device found</Text>
          
          {devices.map((dev) => {
            return (
              <View key={dev.id} style={[styles.deviceCard, { backgroundColor: colors.surface, borderColor: colors.hair }]}>
                <View style={styles.deviceCardLeft}>
                  <Text style={[styles.deviceCardTitle, { color: colors.t1 }]}>{dev.name}</Text>
                  <Text style={[styles.deviceCardSub, { color: colors.t3 }]}>
                    Water Sensor · {dev.rssi} dBm
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.pairButton, { backgroundColor: colors.t1 }]}
                  onPress={() => handleSelectDevice(dev)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.pairButtonText, { color: colors.bg }]}>Pair</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {selectedDevice && !scanning && (
        <View style={{ marginTop: 12 }}>
          <View style={[styles.connectedDeviceCard, { backgroundColor: colors.surface, borderColor: colors.accent + '25' }]}>
            <View style={[styles.connectedIconContainer, { backgroundColor: colors.accent + '15' }]}>
              <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.connectedDeviceTitle, { color: colors.accent }]}>Connected: {selectedDevice.name}</Text>
              {bleModelId !== '' && <Text style={[styles.connectedDeviceSub, { color: colors.t3 }]}>Model ID: {bleModelId}</Text>}
              {bleMac !== '' && <Text style={[styles.connectedDeviceSub, { color: colors.t3, fontFamily: 'JetBrainsMono_400Regular' }]}>MAC: {bleMac}</Text>}
            </View>
          </View>

          <View style={{ marginTop: 18 }}>
            <View style={[styles.customConfigCard, { backgroundColor: colors.surface, borderColor: colors.hair }]}>
              <Text style={[styles.listTitle, { color: colors.t1, marginBottom: 12 }]}>WiFi Configuration</Text>
              
              <Text style={[styles.subLabel, { color: colors.t3, marginBottom: 8 }]}>SELECT YOUR WIFI NETWORK</Text>
              {wifiNetworks.length > 0 ? (
                <View style={styles.wifiListContainer}>
                  {wifiNetworks.map((network, idx) => {
                    const isSelected = wifiSSID === network;
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.wifiNetworkButton,
                          {
                            backgroundColor: isSelected ? colors.accent + '15' : colors.surface,
                            borderColor: isSelected ? colors.accent : colors.hair,
                          }
                        ]}
                        onPress={() => setWifiSSID(network)}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="wifi"
                          size={16}
                          color={isSelected ? colors.accent : colors.t3}
                          style={{ marginRight: 10 }}
                        />
                        <Text
                          style={[
                            styles.wifiNetworkText,
                            {
                              color: isSelected ? colors.accent : colors.t1,
                              fontFamily: isSelected ? 'Poppins_600SemiBold' : 'Poppins_400Regular',
                            }
                          ]}
                          numberOfLines={1}
                        >
                          {network}
                        </Text>
                        {isSelected && (
                          <Ionicons
                            name="checkmark"
                            size={16}
                            color={colors.accent}
                            style={{ marginLeft: 'auto' }}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                  <Text style={[styles.manualText, { color: colors.t3, marginTop: 12, marginBottom: 4 }]}>Or enter manually:</Text>
                </View>
              ) : (
                connecting && <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 10 }} />
              )}

              {/* WiFi Network Field */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.t2 }]}>WiFi Network (SSID)</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.bg,
                      borderColor: ssidFocused ? colors.accent : colors.hair,
                      color: colors.t1,
                    }
                  ]}
                  value={wifiSSID}
                  onChangeText={setWifiSSID}
                  placeholder="Enter WiFi name"
                  placeholderTextColor={colors.t4}
                  onFocus={() => setSsidFocused(true)}
                  onBlur={() => setSsidFocused(false)}
                />
              </View>

              {/* WiFi Password Field */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.t2 }]}>WiFi Password</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.bg,
                      borderColor: passFocused ? colors.accent : colors.hair,
                      color: colors.t1,
                    }
                  ]}
                  value={wifiPassword}
                  onChangeText={setWifiPassword}
                  secureTextEntry
                  placeholder="Enter WiFi password"
                  placeholderTextColor={colors.t4}
                  onFocus={() => setPassFocused(true)}
                  onBlur={() => setPassFocused(false)}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: colors.t1, opacity: connecting ? 0.7 : 1 }]}
                onPress={handleConnect}
                disabled={connecting}
                activeOpacity={0.8}
              >
                <Text style={[styles.submitButtonText, { color: colors.bg }]}>
                  {connecting ? 'Connecting...' : 'Connect & Pair'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {status !== '' && !scanning && (
        <Text style={[styles.statusText, { color: colors.t2, marginTop: 16 }]}>{status}</Text>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

// ─── QR Code Tab ─────────────────────────────────────────────────────────────

function QRTab() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
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
      <View style={[styles.centerContent, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.centerContent, { backgroundColor: colors.bg }]}>
        <Text style={styles.permissionIcon}>📷</Text>
        <Text style={[styles.permissionTitle, { color: colors.t1 }]}>Camera Access Required</Text>
        <Text style={[styles.permissionText, { color: colors.t3 }]}>
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
    <View style={[styles.qrContainer, { backgroundColor: colors.bg }]}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay */}
      <View style={styles.qrOverlay}>
        <View style={styles.qrFrame}>
          <View style={[styles.qrCorner, styles.qrCornerTL, { borderColor: colors.accent }]} />
          <View style={[styles.qrCorner, styles.qrCornerTR, { borderColor: colors.accent }]} />
          <View style={[styles.qrCorner, styles.qrCornerBL, { borderColor: colors.accent }]} />
          <View style={[styles.qrCorner, styles.qrCornerBR, { borderColor: colors.accent }]} />
        </View>
        <Text style={styles.qrHint}>
          {processing ? 'Processing...' : 'Point camera at device QR code'}
        </Text>
      </View>

      {scanned && !processing && (
        <TouchableOpacity
          style={[styles.rescanButton, { backgroundColor: colors.accent }]}
          onPress={() => setScanned(false)}>
          <Text style={styles.rescanText}>Tap to scan again</Text>
        </TouchableOpacity>
      )}
    </View>
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
  
  let targetDevice = device;

  // If the device does not exist in the database (e.g. brand new device config), create it first
  if (!targetDevice) {
    const { data: newDevice, error: createError } = await db
      .from('devices')
      .insert({
        model_id: modelId,
        status: 'online',
        last_seen: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (createError) {
      throw new Error(`Device registration failed: ${createError.message}`);
    }
    targetDevice = newDevice;
  }

  if (!targetDevice?.id) {
    throw new Error('Failed to identify target device.');
  }

  // 2. Check linked user count (max 2)
  const { data: existingLinks } = await db
    .from('user_device')
    .select('*')
    .eq('device_id', targetDevice.id);

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
    device_id: targetDevice.id,
  });

  if (linkError) throw new Error(linkError.message);
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  customHeaderTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 13,
    letterSpacing: 0.22 * 13,
    textTransform: 'uppercase',
  },
  customTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  customTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  customTabText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
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

  // BLE Tab mockup styles
  scanningContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 52,
    paddingBottom: 40,
  },
  ringsContainer: {
    position: 'relative',
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  scanningRing: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 80,
    borderWidth: 1,
  },
  centerBluetoothCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanningText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 13 * 1.6,
  },
  foundContainer: {
    flex: 1,
    paddingTop: 52,
    paddingHorizontal: 24,
  },
  foundLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    letterSpacing: 0.07 * 11,
    textTransform: 'uppercase',
    marginBottom: 14,
    alignSelf: 'flex-start',
  },
  deviceCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  deviceCardLeft: {
    flex: 1,
    gap: 4,
  },
  deviceCardTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
  },
  deviceCardSub: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
  },
  connectingText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
  },
  pairButton: {
    height: 36,
    paddingHorizontal: 20,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pairButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
  },

  // BLE Tab original info & forms (retained for layout/fallback)
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
  statusText: {
    fontSize: FontSizes.sm,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  listTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },

  // QR Tab
  qrContainer: {
    flex: 1,
    position: 'relative',
    minHeight: 450,
  },
  qrOverlay: {
    ...StyleSheet.absoluteFill,
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
    borderWidth: 0,
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
    textAlign: 'center',
  },
  permissionText: {
    fontSize: FontSizes.sm,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  permissionButton: {
    marginTop: Spacing.lg,
    width: '100%',
  },
  connectedDeviceCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  connectedIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectedDeviceTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
  },
  connectedDeviceSub: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    marginTop: 2,
  },
  subLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 10,
    letterSpacing: 1,
  },
  wifiListContainer: {
    marginBottom: 12,
  },
  wifiNetworkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 6,
  },
  wifiNetworkText: {
    fontSize: 13,
    flex: 1,
  },
  manualText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
  },
  infoBanner: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 16,
    marginBottom: 16,
  },
  customConfigCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 6,
    padding: 20,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
    marginTop: 10,
  },
  inputLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  textInput: {
    height: 46,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 16,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
  },
  submitButton: {
    height: 48,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
  },
});
