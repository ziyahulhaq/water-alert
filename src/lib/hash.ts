// ─── SHA-256 Hashing ─────────────────────────────────────────────────────────
// Uses expo-crypto for native SHA-256 hashing of MAC addresses

import * as Crypto from 'expo-crypto';

/**
 * Hashes a MAC address string using SHA-256
 * @param mac - MAC address string (e.g. "aa:bb:cc:dd:ee:ff")
 * @returns Hex-encoded SHA-256 hash
 */
export async function hashMacAddress(mac: string): Promise<string> {
  const normalized = mac.toLowerCase().trim();
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    normalized
  );
  return hash;
}
