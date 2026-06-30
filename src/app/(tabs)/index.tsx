import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { useDevice } from '@/hooks/use-device';
import { getRelativeTime, formatTimestamp } from '@/lib/time-utils';
import { PulseDot } from '@/components/PulseDot';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

export default function DashboardScreen() {
  const { colors } = useTheme();
  const { device, recentEvents, latestEvent, profile, loading, refresh } = useDevice();
  const router = useRouter();

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // ── No device paired → show empty state ──────────────────────────────────
  if (!device) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.bg }]}>
        {/* Icon circle */}
        <View style={[styles.emptyIconCircle, { backgroundColor: colors.surface, borderColor: colors.hair }]}>
          <Ionicons name="hardware-chip-outline" size={40} color={colors.accent} />
        </View>

        <Text style={[styles.emptyTitle, { color: colors.t1 }]}>No device paired</Text>
        <Text style={[styles.emptySubtitle, { color: colors.t3 }]}>
          Pair your WaterAlert sensor to start{`\n`}monitoring water flow in real time.
        </Text>

        <TouchableOpacity
          style={[styles.pairCTA, { backgroundColor: colors.accent }]}
          onPress={() => router.push('/pair-device')}
          activeOpacity={0.8}
        >
          <Ionicons name="bluetooth" size={16} color={colors.bg} style={{ marginRight: 8 }} />
          <Text style={[styles.pairCTAText, { color: colors.bg }]}>Pair a Device</Text>
        </TouchableOpacity>

        <Text style={[styles.emptyHint, { color: colors.t3 }]}>
          Or go to Settings → Pair New Device
        </Text>
      </View>
    );
  }

  // ── Device paired → full dashboard ───────────────────────────────────────
  const waterAvailable = latestEvent?.event_type === 'arrived' && (latestEvent?.water_level ?? 0) > 0;
  const statusColor = waterAvailable ? colors.accent : colors.alert;
  const statusWord = waterAvailable ? 'FLOWING' : 'STOPPED';

  const formatHHMM = (isoString?: string) => {
    if (!isoString) return '--:--';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const timeLabel = waterAvailable ? 'FLOWING SINCE' : 'STOPPED AT';
  const timeValue = formatHHMM(latestEvent?.detected_at);
  const eventsCount = recentEvents.length;
  const deviceName = device?.model_id || 'WTR-01';

  const telegramConnected = !!profile?.chat_id;
  const linkToken = profile?.link_token ? profile.link_token.substring(0, 8).toUpperCase() : '123456';

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(`/link ${linkToken}`);
    Alert.alert('Copied', 'Telegram link command copied to clipboard!');
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
          colors={[colors.accent]}
          progressBackgroundColor={colors.surface}
        />
      }>
      
      {/* Hero Section */}
      <View style={[styles.heroSection, { borderBottomColor: colors.divider }]}>
        <View style={styles.liveIndicatorRow}>
          <PulseDot color={statusColor} size={6} />
          <Text style={[styles.liveLabel, { color: colors.t3 }]}>LIVE</Text>
        </View>
        <Text style={[styles.bigStatusWord, { color: statusColor }]}>
          {statusWord}
        </Text>
        <Text style={[styles.heroSubtitle, { color: colors.t2 }]}>
          {waterAvailable 
            ? `Water has been flowing for ${getRelativeTime(latestEvent?.detected_at || '').replace(' ago', '')}` 
            : `Water stopped ${getRelativeTime(latestEvent?.detected_at || '')}`}
        </Text>
      </View>

      {/* Stats Row */}
      <View style={[styles.statsRow, { borderBottomColor: colors.divider }]}>
        <View style={styles.statCell}>
          <Text style={[styles.statLabel, { color: colors.t3 }]}>{timeLabel}</Text>
          <Text style={[styles.statValue, { color: colors.t1 }]}>{timeValue}</Text>
        </View>
        <View style={[styles.verticalDivider, { backgroundColor: colors.divider }]} />
        <View style={styles.statCell}>
          <Text style={[styles.statLabel, { color: colors.t3 }]}>EVENTS TODAY</Text>
          <Text style={[styles.statValue, { color: colors.t1 }]}>{eventsCount}</Text>
        </View>
        <View style={[styles.verticalDivider, { backgroundColor: colors.divider }]} />
        <View style={styles.statCell}>
          <Text style={[styles.statLabel, { color: colors.t3 }]}>DEVICE</Text>
          <Text style={[styles.statValue, { color: colors.t1 }]}>{deviceName}</Text>
        </View>
      </View>

      {/* Telegram Row */}
      {telegramConnected ? (
        <View style={[styles.telegramRow, { borderBottomColor: colors.divider }]}>
          <PulseDot color={colors.accent} size={6} />
          <View style={styles.telegramTextCol}>
            <Text style={[styles.telegramStatus, { color: colors.t1 }]}>
              Connected
            </Text>
            <Text style={[styles.telegramHandle, { color: colors.t3 }]}>
              Telegram alerts active
            </Text>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.telegramRow, { borderBottomColor: colors.divider }]}
          onPress={handleCopyLink}
          activeOpacity={0.7}
        >
          <PulseDot color={colors.alert} size={6} />
          <View style={styles.telegramTextCol}>
            <Text style={[styles.telegramStatus, { color: colors.t1 }]}>
              Not Connected
            </Text>
            <Text style={[styles.telegramHandle, { color: colors.accent, fontFamily: 'Poppins_600SemiBold' }]}>
              Tap to copy: /link {linkToken}
            </Text>
          </View>
          <Ionicons name="copy-outline" size={16} color={colors.accent} />
        </TouchableOpacity>
      )}

      {/* Recent Activity Section */}
      <View style={styles.activitySection}>
        <View style={styles.activityHeader}>
          <Text style={[styles.activityTitle, { color: colors.t3 }]}>RECENT ACTIVITY</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
            <Text style={[styles.viewAllLink, { color: colors.accent }]}>View all →</Text>
          </TouchableOpacity>
        </View>

        {recentEvents.slice(0, 4).map((event, index) => {
          const isArrived = event.event_type === 'arrived';
          return (
            <View 
              key={event.id} 
              style={[
                styles.activityRow, 
                { borderBottomColor: colors.divider }
              ]}
            >
              <View style={styles.activityRowLeft}>
                <View style={[styles.activityDot, { backgroundColor: isArrived ? colors.accent : colors.alert }]} />
                <Text style={[styles.activityEventLabel, { color: colors.t1 }]}>
                  {isArrived ? 'Water arrived' : 'Water stopped'}
                </Text>
              </View>
              <Text style={[styles.activityTime, { color: colors.t3 }]}>
                {getRelativeTime(event.detected_at)}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Empty / No-device state ───────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 20,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
  pairCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
    marginTop: 8,
  },
  pairCTAText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
  },
  emptyHint: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  
  // Hero
  heroSection: {
    paddingTop: 60,
    paddingBottom: 44,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  liveLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  bigStatusWord: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 48,
    letterSpacing: -0.02 * 48,
  },
  heroSubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 13 * 1.6,
    marginTop: 12,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  statCell: {
    flex: 1,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  verticalDivider: {
    width: 1,
  },
  statLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  statValue: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 18,
  },

  // Telegram
  telegramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    gap: 12,
  },
  telegramTextCol: {
    flex: 1,
  },
  telegramStatus: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    marginBottom: 2,
  },
  telegramHandle: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
  },

  // Activity
  activitySection: {
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  activityTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  viewAllLink: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  activityRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activityEventLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
  },
  activityTime: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
  },
});
