// ─── Water History Screen ────────────────────────────────────────────────────
// Scrollable vertical timeline of the last 50 water flow events

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { TimelineItem } from '@/components/timeline-item';
import { useDevice } from '@/hooks/use-device';
import { getDateGroup } from '@/lib/time-utils';
import { AppColors, FontSizes, Spacing } from '@/constants/theme';

export default function HistoryScreen() {
  const { allEvents, loading, refresh } = useDevice();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // Group events by date
  const groupedEvents = useMemo(() => {
    const groups: { label: string; events: typeof allEvents }[] = [];
    let currentLabel = '';

    for (const event of allEvents) {
      const label = getDateGroup(event.detected_at);
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, events: [] });
      }
      groups[groups.length - 1].events.push(event);
    }

    return groups;
  }, [allEvents]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={AppColors.accentBlue} />
        <Text style={styles.loadingText}>Loading history...</Text>
      </View>
    );
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
      {/* Header Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{allEvents.length}</Text>
          <Text style={styles.statLabel}>Total Events</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {allEvents.filter((e) => e.event_type === 'arrived').length}
          </Text>
          <Text style={[styles.statLabel, { color: AppColors.emerald }]}>
            Arrivals
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {allEvents.filter((e) => e.event_type === 'stopped').length}
          </Text>
          <Text style={[styles.statLabel, { color: AppColors.textMuted }]}>
            Stops
          </Text>
        </View>
      </View>

      {/* Timeline */}
      {groupedEvents.length > 0 ? (
        groupedEvents.map((group) => (
          <View key={group.label} style={styles.dateGroup}>
            <View style={styles.dateHeader}>
              <View style={styles.dateLine} />
              <Text style={styles.dateLabel}>{group.label}</Text>
              <View style={styles.dateLine} />
            </View>
            {group.events.map((event, index) => (
              <TimelineItem
                key={event.id}
                event={event}
                isLast={index === group.events.length - 1}
              />
            ))}
          </View>
        ))
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyTitle}>No History Yet</Text>
          <Text style={styles.emptyText}>
            Water supply events will appear here once your device starts
            reporting.
          </Text>
        </View>
      )}

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

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    backgroundColor: AppColors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppColors.bgCardBorder,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FontSizes['2xl'],
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  statLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: AppColors.divider,
  },

  // Date Groups
  dateGroup: {
    marginBottom: Spacing.md,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: AppColors.divider,
  },
  dateLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: AppColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing['5xl'],
    gap: Spacing.md,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  emptyText: {
    fontSize: FontSizes.sm,
    color: AppColors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
  bottomSpacer: {
    height: Spacing['3xl'],
  },
});
