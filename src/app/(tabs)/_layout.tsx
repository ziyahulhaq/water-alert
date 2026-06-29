import React from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { Header } from '@/components/Header';

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Tabs
        screenOptions={{
          header: () => <Header />,
          tabBarStyle: {
            backgroundColor: colors.bg,
            borderTopWidth: 1,
            borderTopColor: colors.frame,
            height: 64,
            paddingBottom: 8,
            paddingTop: 8,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.t4,
          tabBarLabelStyle: {
            fontFamily: 'Poppins_600SemiBold',
            fontSize: 12,
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Status',
            tabBarIcon: ({ color }) => <Ionicons name="water-outline" size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            tabBarIcon: ({ color }) => <Ionicons name="time-outline" size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color }) => <Ionicons name="cog-outline" size={24} color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
