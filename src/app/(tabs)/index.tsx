// ─── Dashboard Screen ────────────────────────────────────────────────────────
// Main screen with status cards, recent events, Telegram card, and simulator

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { GlassCard } from '@/components/ui/glass-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { SimulatorPanel } from '@/components/simulator-panel';
import { TelegramCard } from '@/components/telegram-card';
import { useDevice } from '@/hooks/use-device';
import { useAuth } from '@/hooks/use-auth';
import { isMockMode } from '@/lib/storage-client';
import { getRelativeTime, formatTimestamp } from '@/lib/time-utils';
import { AppColors, BorderRadius, FontSizes, Spacing } from '@/constants/theme';

export default function DashboardScreen() {
  const { user } = useAuth();
  const { device, recentEvents, latestEvent, profile, loading, refresh } =
    useDevice();

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={AppColors.accentBlue} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  const waterAvailable =
    latestEvent?.event_type === 'arrived' && (latestEvent?.water_level ?? 0) > 0;
  const deviceOnline = device?.status === 'online';

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
      {/* Greeting */}
      <Text style={styles.greeting}>
        Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''} 👋
      </Text>

      {/* ─── Status Cards Row ───────────────────────────────────────── */}
      <View style={styles.statusRow}>
        {/* Water Availability */}
        <GlassCard
          style={styles.statusCard}
          glowColor={waterAvailable ? AppColors.emerald : undefined}>
          <Text style={styles.statusCardIcon}>
            {waterAvailable ? '💧' : '🚫'}
          </Text>
          <Text style={styles.statusCardLabel}>Water Supply</Text>
          <StatusBadge
            label={waterAvailable ? 'Available' : 'Not Available'}
            color={waterAvailable ? AppColors.emerald : AppColors.textMuted}
            pulse={waterAvailable}
            size="md"
          />
        </GlassCard>

        {/* Device Connectivity */}
        <GlassCard
          style={styles.statusCard}
          glowColor={deviceOnline ? AppColors.accentBlue : undefined}>
          <Text style={styles.statusCardIcon}>
            {deviceOnline ? '📡' : '📵'}
          </Text>
          <Text style={styles.statusCardLabel}>Device</Text>
          <StatusBadge
            label={device ? (deviceOnline ? 'Online' : 'Offline') : 'No Device'}
            color={
              device
                ? deviceOnline
                  ? AppColors.accentBlue
                  : AppColors.danger
                : AppColors.textMuted
            }
            pulse={deviceOnline}
            size="md"
          />
        </GlassCard>
      </View>

      {/* ─── Last Water Detection ───────────────────────────────────── */}
      <GlassCard>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>🕐</Text>
          <Text style={styles.sectionTitle}>Last Water Detection</Text>
        </View>
        {latestEvent ? (
          <View style={styles.lastDetection}>
            <Text style={styles.lastDetectionTime}>
              {formatTimestamp(latestEvent.detected_at)}
            </Text>
            <View style={styles.relativeTimeChip}>
              <Text style={styles.relativeTimeText}>
                {getRelativeTime(latestEvent.detected_at)}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.noDataText}>No events recorded yet</Text>
        )}
      </GlassCard>

      {/* ─── Recent Water Supply Events ─────────────────────────────── */}
      <GlassCard>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>📋</Text>
          <Text style={styles.sectionTitle}>Recent Events</Text>
        </View>
        {recentEvents.length > 0 ? (
          <View style={styles.eventsList}>
            {recentEvents.map((event, index) => (
              <View
                key={event.id}
                style={[
                  styles.eventItem,
                  index < recentEvents.length - 1 && styles.eventItemBorder,
                ]}>
                <View style={styles.eventLeft}>
                  <Text style={styles.eventIcon}>
                    {event.event_type === 'arrived' ? '💧' : '⏹'}
                  </Text>
                  <View>
                    <Text
                      style={[
                        styles.eventTitle,
                        {
                          color:
                            event.event_type === 'arrived'
                              ? AppColors.emerald
                              : AppColors.textMuted,
                        },
                      ]}>
                      {event.event_type === 'arrived'
                        ? 'Water Arrived'
                        : 'Water Stopped'}
                    </Text>
                    <Text style={styles.eventTime}>
                      {formatTimestamp(event.detected_at)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.eventRelative}>
                  {getRelativeTime(event.detected_at)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noDataText}>No recent events</Text>
        )}
      </GlassCard>

      {/* ─── Telegram Connect Card ──────────────────────────────────── */}
      <TelegramCard
        chatId={profile?.chat_id ?? null}
        linkToken={profile?.link_token ?? null}
      />

      {/* ─── ESP32 Simulator (Mock Mode Only) ───────────────────────── */}
      {isMockMode && device && (
        <SimulatorPanel deviceId={device.id} onAction={refresh} />
      )}

      {/* Bottom spacing */}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.bgPrimary,
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSizes.md,
    color: AppColors.textMuted,
  },
  greeting: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: AppColors.textPrimary,
    marginBottom: Spacing.lg,
  },

  // Status Cards
  statusRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  statusCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  statusCardIcon: {
    fontSize: 36,
    marginBottom: Spacing.xs,
  },
  statusCardLabel: {
    fontSize: FontSizes.sm,
    color: AppColors.textMuted,
    fontWeight: '500',
  },

  // Last Detection
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionIcon: {
    fontSize: 18,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  lastDetection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastDetectionTime: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: AppColors.textPrimary,
  },
  relativeTimeChip: {
    backgroundColor: AppColors.accentBlue + '20',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  relativeTimeText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: AppColors.accentBlue,
  },
  noDataText: {
    fontSize: FontSizes.sm,
    color: AppColors.textMuted,
    fontStyle: 'italic',
  },

  // Recent Events
  eventsList: {
    gap: 0,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  eventItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: AppColors.divider,
  },
  eventLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  eventIcon: {
    fontSize: 20,
  },
  eventTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  eventTime: {
    fontSize: FontSizes.xs,
    color: AppColors.textMuted,
    marginTop: 1,
  },
  eventRelative: {
    fontSize: FontSizes.xs,
    color: AppColors.textMuted,
    backgroundColor: AppColors.bgSecondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  bottomSpacer: {
    height: Spacing['3xl'],
  },
});
