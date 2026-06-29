// ─── Timeline Item Component ─────────────────────────────────────────────────
// Water event timeline entry with vertical connector line, icon, and metadata

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppColors, BorderRadius, FontSizes, Spacing } from '@/constants/theme';
import { formatTimestamp, getRelativeTime } from '@/lib/time-utils';
import type { WaterEvent } from '@/types/database';

interface TimelineItemProps {
  event: WaterEvent;
  isLast?: boolean;
}

export function TimelineItem({ event, isLast }: TimelineItemProps) {
  const isArrived = event.event_type === 'arrived';
  const dotColor = isArrived ? AppColors.emerald : AppColors.textMuted;
  const lineColor = isArrived ? AppColors.emerald + '30' : AppColors.divider;

  return (
    <View style={styles.container}>
      {/* Timeline connector */}
      <View style={styles.timeline}>
        <View style={[styles.dot, { backgroundColor: dotColor }]}>
          <Text style={styles.dotIcon}>{isArrived ? '💧' : '⏹'}</Text>
        </View>
        {!isLast && <View style={[styles.line, { backgroundColor: lineColor }]} />}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.title, { color: isArrived ? AppColors.emerald : AppColors.textMuted }]}>
          {isArrived ? 'Water Supply Arrived' : 'Water Supply Stopped'}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.time}>{formatTimestamp(event.detected_at)}</Text>
          <Text style={styles.relative}>{getRelativeTime(event.detected_at)}</Text>
        </View>
        <View style={styles.detailsRow}>
          <DetailChip label="Level" value={getLevelLabel(event.water_level)} />
          <DetailChip label="Sensor" value={String(event.sensor_value)} />
        </View>
      </View>
    </View>
  );
}

function DetailChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={styles.chipValue}>{value}</Text>
    </View>
  );
}

function getLevelLabel(level: number): string {
  switch (level) {
    case 0: return 'None';
    case 1: return 'Low';
    case 2: return 'Medium';
    case 3: return 'High';
    default: return '—';
  }
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingRight: Spacing.lg,
  },
  timeline: {
    width: 40,
    alignItems: 'center',
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotIcon: {
    fontSize: 14,
  },
  line: {
    width: 2,
    flex: 1,
    marginVertical: 2,
  },
  content: {
    flex: 1,
    paddingBottom: Spacing.xl,
    paddingLeft: Spacing.md,
  },
  title: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  time: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
  },
  relative: {
    fontSize: FontSizes.xs,
    color: AppColors.textMuted,
    backgroundColor: AppColors.bgSecondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  detailsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: AppColors.bgSecondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  chipLabel: {
    fontSize: FontSizes.xs,
    color: AppColors.textMuted,
  },
  chipValue: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: AppColors.textSecondary,
  },
});
