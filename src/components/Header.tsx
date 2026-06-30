import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { useDevice } from '@/hooks/use-device';
import { PulseDot } from './PulseDot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const Header: React.FC = () => {
  const { colors } = useTheme();
  const { device } = useDevice();
  const insets = useSafeAreaInsets();
  const isOnline = device?.status === 'online';
  
  const statusColor = isOnline ? colors.accent : colors.alert;

  return (
    <View style={[
      styles.header, 
      { 
        borderBottomColor: colors.frame, 
        backgroundColor: colors.bg,
        paddingTop: insets.top,
        height: 52 + insets.top
      }
    ]}>
      <Text style={[styles.title, { color: colors.t1 }]}>WATER ALERT</Text>
      <View style={styles.statusContainer}>
        <PulseDot color={statusColor} />
        <Text style={[styles.statusText, { color: colors.t2 }]}>
          {isOnline ? 'ONLINE' : 'OFFLINE'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 52,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  title: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 13,
    letterSpacing: 0.22 * 13,
    textTransform: 'uppercase',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    letterSpacing: 0.04 * 11,
    textTransform: 'uppercase',
  },
});
