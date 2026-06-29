// ─── Tab Selector Component ──────────────────────────────────────────────────
// Custom segmented tab selector for the pair-device screen

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AppColors, BorderRadius, FontSizes, Spacing } from '@/constants/theme';

interface Tab {
  key: string;
  label: string;
  icon?: string; // emoji
}

interface TabSelectorProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

export function TabSelector({ tabs, activeTab, onTabChange }: TabSelectorProps) {
  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onTabChange(tab.key)}
            activeOpacity={0.7}>
            {tab.icon && <Text style={styles.icon}>{tab.icon}</Text>}
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: AppColors.bgSecondary,
    borderRadius: BorderRadius.md,
    padding: 3,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  tabActive: {
    backgroundColor: AppColors.accentBlue,
  },
  icon: {
    fontSize: 14,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: AppColors.textMuted,
  },
  labelActive: {
    color: AppColors.white,
  },
});
