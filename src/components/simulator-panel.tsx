// ─── ESP32 Simulator Panel ───────────────────────────────────────────────────
// Collapsible hardware simulator for sandbox/mock mode

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { GlassCard } from '@/components/ui/glass-card';
import { AppColors, BorderRadius, FontSizes, Spacing } from '@/constants/theme';
import {
  simulatorSetDeviceStatus,
  simulatorToggleWater,
} from '@/lib/mock-storage';

interface SimulatorPanelProps {
  deviceId: string;
  onAction: () => void; // Callback to refresh data after action
}

export function SimulatorPanel({ deviceId, onAction }: SimulatorPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAction = async (
    action: string,
    fn: () => Promise<void>
  ) => {
    setActionLoading(action);
    await fn();
    // Small delay for visual feedback
    setTimeout(() => {
      setActionLoading(null);
      onAction();
    }, 300);
  };

  return (
    <GlassCard style={styles.container} glowColor={AppColors.amber}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>🔧</Text>
          <View>
            <Text style={styles.headerTitle}>ESP32 Simulator</Text>
            <Text style={styles.headerSub}>Sandbox Mode</Text>
          </View>
        </View>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Device Status</Text>
          <View style={styles.buttonRow}>
            <SimButton
              label="Set Online"
              icon="🟢"
              color={AppColors.emerald}
              loading={actionLoading === 'online'}
              onPress={() =>
                handleAction('online', () =>
                  simulatorSetDeviceStatus(deviceId, 'online')
                )
              }
            />
            <SimButton
              label="Set Offline"
              icon="🔴"
              color={AppColors.danger}
              loading={actionLoading === 'offline'}
              onPress={() =>
                handleAction('offline', () =>
                  simulatorSetDeviceStatus(deviceId, 'offline')
                )
              }
            />
          </View>

          <Text style={[styles.sectionLabel, styles.mt]}>Water Flow</Text>
          <View style={styles.buttonRow}>
            <SimButton
              label="Start Flow"
              icon="💧"
              color={AppColors.accentBlue}
              loading={actionLoading === 'water_on'}
              onPress={() =>
                handleAction('water_on', () =>
                  simulatorToggleWater(deviceId, true)
                )
              }
            />
            <SimButton
              label="Stop Flow"
              icon="🚫"
              color={AppColors.textMuted}
              loading={actionLoading === 'water_off'}
              onPress={() =>
                handleAction('water_off', () =>
                  simulatorToggleWater(deviceId, false)
                )
              }
            />
          </View>
        </View>
      )}
    </GlassCard>
  );
}

// ─── Simulator Button ────────────────────────────────────────────────────────

function SimButton({
  label,
  icon,
  color,
  loading,
  onPress,
}: {
  label: string;
  icon: string;
  color: string;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.simButton, { borderColor: color + '40' }]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.7}>
      <Text style={styles.simButtonIcon}>{loading ? '⏳' : icon}</Text>
      <Text style={[styles.simButtonLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderColor: AppColors.amber + '30',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerIcon: {
    fontSize: 24,
  },
  headerTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: AppColors.amber,
  },
  headerSub: {
    fontSize: FontSizes.xs,
    color: AppColors.textMuted,
  },
  chevron: {
    fontSize: FontSizes.sm,
    color: AppColors.textMuted,
  },
  body: {
    marginTop: Spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: AppColors.divider,
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: AppColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  mt: {
    marginTop: Spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  simButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: AppColors.bgSecondary,
    borderWidth: 1,
  },
  simButtonIcon: {
    fontSize: 16,
  },
  simButtonLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
});
