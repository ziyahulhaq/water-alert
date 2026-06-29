// ─── Tabs Layout ─────────────────────────────────────────────────────────────
// Tab navigator with Dashboard, History, and Settings tabs

import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { AppColors, FontSizes, Spacing, BorderRadius } from '@/constants/theme';

export default function TabsLayout() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerStyle: {
            backgroundColor: AppColors.bgSecondary,
            borderBottomWidth: 0,
            elevation: 0,
            shadowOpacity: 0,
          },
          headerTintColor: AppColors.textPrimary,
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: FontSizes.lg,
          },
          headerRight: () => (
            <TouchableOpacity
              style={styles.pairButton}
              onPress={() => router.push('/pair-device')}
              activeOpacity={0.7}>
              <Text style={styles.pairButtonIcon}>📡</Text>
              <Text style={styles.pairButtonText}>Pair</Text>
            </TouchableOpacity>
          ),
          tabBarStyle: {
            backgroundColor: AppColors.bgSecondary,
            borderTopWidth: 1,
            borderTopColor: AppColors.divider,
            height: 65,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarActiveTintColor: AppColors.accentBlue,
          tabBarInactiveTintColor: AppColors.textMuted,
          tabBarLabelStyle: {
            fontSize: FontSizes.xs,
            fontWeight: '600',
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            headerTitle: '💧 Smart Water Alert',
            tabBarIcon: ({ color }) => <TabIcon icon="🏠" color={color} />,
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            headerTitle: '📊 Water History',
            tabBarIcon: ({ color }) => <TabIcon icon="📊" color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            headerTitle: '⚙️ Settings',
            tabBarIcon: ({ color }) => <TabIcon icon="⚙️" color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}

function TabIcon({ icon, color: _color }: { icon: string; color: string }) {
  return (
    <View style={styles.tabIconContainer}>
      <Text style={styles.tabIcon}>{icon}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.bgPrimary,
  },
  pairButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: AppColors.accentBlue + '20',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    marginRight: Spacing.lg,
    borderWidth: 1,
    borderColor: AppColors.accentBlue + '30',
  },
  pairButtonIcon: {
    fontSize: 14,
  },
  pairButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: AppColors.accentBlue,
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    fontSize: 22,
  },
});
