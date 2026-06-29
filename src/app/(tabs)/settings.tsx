// ─── Settings Screen ─────────────────────────────────────────────────────────
// Native Push Notifications, WhatsApp config, and account management

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import Constants from 'expo-constants';
import { GlassCard } from '@/components/ui/glass-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { GradientButton } from '@/components/ui/gradient-button';
import { InputField } from '@/components/ui/input-field';
import { useAuth } from '@/hooks/use-auth';
import { useDevice } from '@/hooks/use-device';
import { db, isMockMode } from '@/lib/storage-client';
import { AppColors, BorderRadius, FontSizes, Spacing } from '@/constants/theme';

// Safely require expo-notifications to prevent crashing in Expo Go SDK 53+ on Android
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  console.warn('expo-notifications could not be initialized:', e);
}

// ─── Push Notification Status ────────────────────────────────────────────────

type PushStatus = 'Enabled' | 'Disabled' | 'Permission Denied' | 'Not Supported' | 'Loading';

function getPushStatusColor(status: PushStatus): string {
  switch (status) {
    case 'Enabled': return AppColors.emerald;
    case 'Disabled': return AppColors.amber;
    case 'Permission Denied': return AppColors.danger;
    case 'Not Supported': return AppColors.textMuted;
    default: return AppColors.textMuted;
  }
}

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { notificationSettings, profile, refresh } = useDevice();

  const [pushStatus, setPushStatus] = useState<PushStatus>('Loading');
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [enablingPush, setEnablingPush] = useState(false);

  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ─── Check Push Permission on Mount ──────────────────────────────
  useEffect(() => {
    checkPushPermissions();
  }, []);

  // ─── Load WhatsApp settings ──────────────────────────────────────
  useEffect(() => {
    if (notificationSettings) {
      setWhatsappEnabled(notificationSettings.enabled);
      setWhatsappNumber(notificationSettings.whatsapp_number ?? '');
    }
  }, [notificationSettings]);

  useEffect(() => {
    if (profile?.push_token) {
      setPushToken(profile.push_token);
    }
  }, [profile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    await checkPushPermissions();
    setRefreshing(false);
  }, [refresh]);

  async function checkPushPermissions() {
    try {
      if (Platform.OS === 'web' || !Notifications) {
        setPushStatus('Not Supported');
        return;
      }

      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'granted') {
        setPushStatus(profile?.push_token ? 'Enabled' : 'Disabled');
      } else if (status === 'denied') {
        setPushStatus('Permission Denied');
      } else {
        setPushStatus('Disabled');
      }
    } catch {
      setPushStatus('Not Supported');
    }
  }

  // ─── Enable Push Notifications ───────────────────────────────────
  async function handleEnablePush() {
    if (!Notifications) {
      Alert.alert(
        'Not Supported',
        'Push notifications are not supported in Expo Go on Android. Please use a development build to register real device tokens.'
      );
      return;
    }

    try {
      setEnablingPush(true);

      // Request permission
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        setPushStatus('Permission Denied');
        Alert.alert(
          'Permission Denied',
          'Please enable notifications in your device settings.'
        );
        return;
      }

      // Create Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('water_alerts', {
          name: 'Water Alerts',
          description: 'Emergency water supply notifications',
          importance: Notifications.AndroidImportance.MAX,
          sound: 'default',
          vibrationPattern: [0, 500, 250, 500],
          enableLights: true,
          lightColor: '#3B82F6',
          enableVibrate: true,
          showBadge: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }

      // Get Expo Push Token
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;

      let token: string;
      if (projectId) {
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      } else {
        // Fallback for development
        token = (await Notifications.getExpoPushTokenAsync()).data;
      }

      setPushToken(token);

      // Save to database
      if (user) {
        await db.from('profiles').update({ push_token: token }).eq('id', user.id);
      }

      setPushStatus('Enabled');
      Alert.alert('Success', 'Push notifications enabled!');
    } catch (error) {
      console.error('Push notification error:', error);
      Alert.alert('Error', 'Failed to enable push notifications.');
    } finally {
      setEnablingPush(false);
    }
  }

  // ─── Save WhatsApp Settings ──────────────────────────────────────
  async function handleSaveWhatsapp() {
    setWhatsappError(null);

    if (whatsappEnabled && whatsappNumber.trim()) {
      // Validate phone number (basic E.164 format check)
      const phoneRegex = /^\+[1-9]\d{6,14}$/;
      if (!phoneRegex.test(whatsappNumber.trim())) {
        setWhatsappError('Enter a valid number with country code (e.g., +1234567890)');
        return;
      }
    }

    try {
      setSavingWhatsapp(true);
      if (user) {
        await db.from('notification_settings').upsert({
          user_id: user.id,
          whatsapp_number: whatsappNumber.trim() || null,
          enabled: whatsappEnabled,
        });
      }
      Alert.alert('Saved', 'WhatsApp settings updated.');
    } catch {
      Alert.alert('Error', 'Failed to save settings.');
    } finally {
      setSavingWhatsapp(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={AppColors.accentBlue}
          colors={[AppColors.accentBlue]}
          progressBackgroundColor={AppColors.bgSecondary}
        />
      }>
      {/* ─── Native Push Notifications ──────────────────────────────── */}
      <GlassCard>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>🔔</Text>
          <Text style={styles.sectionTitle}>Push Notifications</Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Status</Text>
          <StatusBadge
            label={pushStatus}
            color={getPushStatusColor(pushStatus)}
            size="md"
          />
        </View>

        {pushToken && (
          <View style={styles.tokenContainer}>
            <Text style={styles.tokenLabel}>Push Token</Text>
            <View style={styles.tokenBox}>
              <Text style={styles.tokenValue} selectable numberOfLines={2}>
                {pushToken}
              </Text>
            </View>
          </View>
        )}

        {pushStatus !== 'Enabled' && pushStatus !== 'Not Supported' && (
          <GradientButton
            title="Enable Notifications"
            icon="🔔"
            onPress={handleEnablePush}
            loading={enablingPush}
            style={styles.pushButton}
          />
        )}
      </GlassCard>

      {/* ─── WhatsApp Configuration ─────────────────────────────────── */}
      <GlassCard>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>💬</Text>
          <Text style={styles.sectionTitle}>WhatsApp Notifications</Text>
        </View>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Enable WhatsApp alerts</Text>
          <Switch
            value={whatsappEnabled}
            onValueChange={setWhatsappEnabled}
            trackColor={{
              false: AppColors.bgSecondary,
              true: AppColors.emerald + '60',
            }}
            thumbColor={whatsappEnabled ? AppColors.emerald : AppColors.textMuted}
          />
        </View>

        {whatsappEnabled && (
          <InputField
            label="Phone Number"
            icon="📱"
            placeholder="+1234567890"
            value={whatsappNumber}
            onChangeText={setWhatsappNumber}
            keyboardType="phone-pad"
            error={whatsappError}
          />
        )}

        <GradientButton
          title="Save WhatsApp Settings"
          icon="💾"
          onPress={handleSaveWhatsapp}
          loading={savingWhatsapp}
          variant="secondary"
          colors={['#374151', '#4B5563']}
          style={styles.saveButton}
        />
      </GlassCard>

      {/* ─── Account Section ────────────────────────────────────────── */}
      <GlassCard>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>👤</Text>
          <Text style={styles.sectionTitle}>Account</Text>
        </View>

        <View style={styles.accountInfo}>
          <Text style={styles.accountLabel}>Email</Text>
          <Text style={styles.accountValue}>{user?.email ?? '—'}</Text>
        </View>

        {isMockMode && (
          <View style={styles.mockIndicator}>
            <Text style={styles.mockText}>🧪 Running in Demo Mode</Text>
          </View>
        )}

        <GradientButton
          title="Sign Out"
          icon="🚪"
          onPress={() => {
            Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: signOut },
            ]);
          }}
          variant="danger"
          style={styles.signOutButton}
        />
      </GlassCard>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.bgPrimary,
  },
  content: {
    padding: Spacing.lg,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sectionIcon: {
    fontSize: 20,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },

  // Push Notifications
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  statusLabel: {
    fontSize: FontSizes.md,
    color: AppColors.textSecondary,
  },
  tokenContainer: {
    marginBottom: Spacing.lg,
  },
  tokenLabel: {
    fontSize: FontSizes.xs,
    color: AppColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  tokenBox: {
    backgroundColor: AppColors.bgSecondary,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: AppColors.bgInputBorder,
  },
  tokenValue: {
    fontSize: FontSizes.xs,
    fontFamily: 'monospace',
    color: AppColors.accentBlueBright,
  },
  pushButton: {
    marginTop: Spacing.sm,
  },

  // WhatsApp
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  toggleLabel: {
    fontSize: FontSizes.md,
    color: AppColors.textSecondary,
  },
  saveButton: {
    marginTop: Spacing.sm,
  },

  // Account
  accountInfo: {
    marginBottom: Spacing.lg,
  },
  accountLabel: {
    fontSize: FontSizes.xs,
    color: AppColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  accountValue: {
    fontSize: FontSizes.md,
    color: AppColors.textPrimary,
    fontWeight: '500',
  },
  mockIndicator: {
    backgroundColor: AppColors.amber + '15',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: AppColors.amber + '25',
  },
  mockText: {
    fontSize: FontSizes.sm,
    color: AppColors.amber,
    textAlign: 'center',
  },
  signOutButton: {
    marginTop: Spacing.xs,
  },
  bottomSpacer: {
    height: Spacing['3xl'],
  },
});
