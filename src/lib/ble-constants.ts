// ─── BLE Constants ───────────────────────────────────────────────────────────
// GATT Service and Characteristic UUIDs for ESP32 Water Alert device

export const BLE_DEVICE_PREFIX = 'WaterAlert-';

export const BLE_SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';

export const BLE_CHARACTERISTICS = {
  /** Write: WiFi SSID */
  SSID: '12345678-1234-5678-1234-56789abcde01',
  /** Write: WiFi Password */
  PASSWORD: '12345678-1234-5678-1234-56789abcde02',
  /** Read: Device MAC Address */
  MAC_ADDRESS: '12345678-1234-5678-1234-56789abcde03',
  /** Notify/Read: Connection Status */
  STATUS: '12345678-1234-5678-1234-56789abcde04',
  /** Read: Device Model ID */
  MODEL_ID: '12345678-1234-5678-1234-56789abcde05',
  /** Read: Scanned WiFi Networks List */
  WIFI_SCAN_LIST: '12345678-1234-5678-1234-56789abcde06',
} as const;

export const BLE_STATUS_CONNECTED = 'CONNECTED';
export const BLE_CONNECTION_TIMEOUT_MS = 30000;
