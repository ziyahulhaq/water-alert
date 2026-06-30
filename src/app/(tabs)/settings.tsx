import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Animated,
} from 'react-native';
import { useAuth } from '@/hooks/use-auth';
import { useDevice } from '@/hooks/use-device';
import { useTheme } from '@/theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { PulseDot } from '@/components/PulseDot';
import * as Clipboard from 'expo-clipboard';
import { db } from '@/lib/storage-client';
import { useRouter } from 'expo-router';

const PillToggle = ({ value, onToggle, colors }: { value: boolean, onToggle: (v: boolean) => void, colors: any }) => {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const bg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', colors.accent + '33'], // semi transparent accent
  });

  const border = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.t4, colors.accent],
  });

  const translate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 20],
  });

  const knobColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.t3, colors.accent],
  });

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={() => onToggle(!value)}>
      <Animated.View style={[styles.pillTrack, { backgroundColor: bg, borderColor: border }]}>
        <Animated.View style={[styles.pillKnob, { backgroundColor: knobColor, transform: [{ translateX: translate }] }]} />
      </Animated.View>
    </TouchableOpacity>
  );
};

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { device, profile, refresh } = useDevice();
  const { colors, theme, isDark, setTheme } = useTheme();
  const router = useRouter();

  const [notifyArrives, setNotifyArrives] = useState(true);
  const [notifyStops, setNotifyStops] = useState(true);
  const [notifySummary, setNotifySummary] = useState(false);
  const [quietExpanded, setQuietExpanded] = useState(false);

  const telegramConnected = !!profile?.chat_id;
  const linkToken = profile?.link_token ? profile.link_token.substring(0, 8).toUpperCase() : '123456';
  
  const isOnline = device?.status === 'online';

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const handleCopy = async () => {
    const cmd = `/link ${linkToken}`;
    await Clipboard.setStringAsync(cmd);
    Alert.alert('Copied', 'Telegram link command copied to clipboard!');
  };

  const handleDisconnectTelegram = async () => {
    if (!user) return;
    Alert.alert(
      'Disconnect Telegram',
      'Are you sure you want to disconnect Telegram alerts from your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await db
                .from('profiles')
                .update({ chat_id: null })
                .eq('id', user.id);
              if (error) {
                Alert.alert('Error', error.message);
              } else {
                Alert.alert('Success', 'Telegram account disconnected.');
                if (refresh) await refresh();
              }
            } catch (err) {
              console.error(err);
              Alert.alert('Error', 'An unexpected error occurred.');
            }
          },
        },
      ]
    );
  };

  const handleCheckTelegramLink = async () => {
    if (refresh) {
      await refresh();
      Alert.alert(
        'Checking Link Status',
        'Checking if your Telegram account is linked. If not, make sure you sent the command to @WaterAlertBot.'
      );
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>

      {/* APPEARANCE */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.t3 }]}>APPEARANCE</Text>
        <View style={[styles.row, { borderBottomColor: colors.divider }]}>
          <View style={styles.rowLeft}>
            <Ionicons name={isDark ? "moon-outline" : "sunny-outline"} size={19} color={colors.t2} />
            <View>
              <Text style={[styles.rowTitle, { color: colors.t1 }]}>Dark mode</Text>
              <Text style={[styles.rowSub, { color: colors.t3 }]}>
                {isDark ? 'Using the dark theme' : 'Using the light theme'}
              </Text>
            </View>
          </View>
          <PillToggle value={isDark} onToggle={(v) => setTheme(v ? 'dark' : 'light')} colors={colors} />
        </View>
      </View>

      {/* DEVICE */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.t3 }]}>DEVICE</Text>
        
        <View style={[styles.infoRow, { borderBottomColor: colors.divider }]}>
          <Text style={[styles.infoLabel, { color: colors.t2 }]}>Pairing Status</Text>
          <Text style={[styles.infoValue, { color: device ? colors.accent : colors.t3, fontFamily: 'Poppins_600SemiBold' }]}>
            {device ? 'Paired' : 'Not Paired'}
          </Text>
        </View>

        {device && (
          <>
            <View style={[styles.infoRow, { borderBottomColor: colors.divider }]}>
              <Text style={[styles.infoLabel, { color: colors.t2 }]}>Device ID</Text>
              <Text style={[styles.infoValue, { color: colors.t1, fontFamily: 'JetBrainsMono_400Regular' }]}>
                {device.model_id || device.id}
              </Text>
            </View>

            <View style={[styles.infoRow, { borderBottomColor: colors.divider }]}>
              <Text style={[styles.infoLabel, { color: colors.t2 }]}>Status</Text>
              <View style={styles.statusValContainer}>
                <PulseDot color={isOnline ? colors.accent : colors.alert} size={6} />
                <Text style={[styles.infoValue, { color: colors.t1 }]}>{isOnline ? 'Online' : 'Offline'}</Text>
              </View>
            </View>

            <View style={[styles.infoRow, { borderBottomColor: colors.divider }]}>
              <Text style={[styles.infoLabel, { color: colors.t2 }]}>Last sync</Text>
              <Text style={[styles.infoValue, { color: colors.t1 }]}>
                {device?.last_seen ? new Date(device.last_seen).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' }) : 'Never'}
              </Text>
            </View>
          </>
        )}

        {!device && (
          <TouchableOpacity 
            style={[styles.row, { borderBottomColor: colors.divider }]} 
            onPress={() => router.push('/pair-device')}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="bluetooth" size={19} color={colors.accent} />
              <View>
                <Text style={[styles.rowTitle, { color: colors.t1 }]}>Pair New Device</Text>
                <Text style={[styles.rowSub, { color: colors.t3 }]}>Add and configure WTR-01 sensor</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward-outline" size={18} color={colors.t3} />
          </TouchableOpacity>
        )}
      </View>

      {/* TELEGRAM */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.t3 }]}>TELEGRAM</Text>
        {telegramConnected ? (
          <View style={[styles.row, { borderBottomColor: colors.divider, paddingVertical: 16 }]}>
            <View style={styles.rowLeft}>
              <PulseDot color={colors.accent} size={6} />
              <View>
                <Text style={[styles.rowTitle, { color: colors.t1 }]}>Connected</Text>
                <Text style={[styles.monoSub, { color: colors.t3 }]}>@waterbot</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={[styles.disconnectBtn, { borderColor: colors.alert }]}
              onPress={handleDisconnectTelegram}
              activeOpacity={0.7}
            >
              <Text style={[styles.disconnectText, { color: colors.alert }]}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.telegramBox}>
            <Text style={[styles.instructionText, { color: colors.t2 }]}>
              Link your account by sending a message to <Text style={{color: colors.t1}}>@WaterAlertBot</Text> on Telegram.
            </Text>
            <View style={[styles.codeBlock, { backgroundColor: colors.surface, borderColor: colors.hair }]}>
              <Text style={[styles.codeText, { color: colors.t1 }]}>/link {linkToken}</Text>
              <TouchableOpacity onPress={handleCopy} activeOpacity={0.7}>
                <Text style={[styles.copyText, { color: colors.accent }]}>Copy</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity 
              style={[styles.outlineBtn, { borderColor: colors.frame }]}
              onPress={handleCheckTelegramLink}
              activeOpacity={0.7}
            >
              <Text style={[styles.outlineBtnText, { color: colors.t1 }]}>I've sent the command</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* NOTIFICATIONS */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.t3 }]}>NOTIFICATIONS</Text>
        
        <View style={[styles.row, { borderBottomColor: colors.divider }]}>
          <View style={styles.rowLeft}>
            <View>
              <Text style={[styles.rowTitle, { color: colors.t1 }]}>Water arrives</Text>
              <Text style={[styles.rowSub, { color: colors.t3, lineHeight: 16.5 }]}>Get notified when water starts flowing</Text>
            </View>
          </View>
          <PillToggle value={notifyArrives} onToggle={setNotifyArrives} colors={colors} />
        </View>

        <View style={[styles.row, { borderBottomColor: colors.divider }]}>
          <View style={styles.rowLeft}>
            <View>
              <Text style={[styles.rowTitle, { color: colors.t1 }]}>Water stops</Text>
              <Text style={[styles.rowSub, { color: colors.t3, lineHeight: 16.5 }]}>Get notified when water stops</Text>
            </View>
          </View>
          <PillToggle value={notifyStops} onToggle={setNotifyStops} colors={colors} />
        </View>

        <View style={[styles.row, { borderBottomColor: colors.divider }]}>
          <View style={styles.rowLeft}>
            <View>
              <Text style={[styles.rowTitle, { color: colors.t1 }]}>Daily summary</Text>
              <Text style={[styles.rowSub, { color: colors.t3, lineHeight: 16.5 }]}>Receive a summary every evening</Text>
            </View>
          </View>
          <PillToggle value={notifySummary} onToggle={setNotifySummary} colors={colors} />
        </View>

        <TouchableOpacity 
          style={[styles.row, { borderBottomColor: colors.divider }]} 
          onPress={() => setQuietExpanded(!quietExpanded)}
          activeOpacity={0.7}
        >
          <View style={styles.rowLeft}>
            <Text style={[styles.rowTitle, { color: colors.t1 }]}>Quiet hours</Text>
          </View>
          <Ionicons name={quietExpanded ? "chevron-up-outline" : "chevron-down-outline"} size={20} color={colors.t2} />
        </TouchableOpacity>

        {quietExpanded && (
          <View style={[styles.quietExpandedBox, { borderBottomColor: colors.divider }]}>
            <View style={styles.timePickerCol}>
              <Text style={[styles.infoLabel, { color: colors.t2 }]}>FROM</Text>
              <View style={[styles.timeBox, { backgroundColor: colors.surface, borderColor: colors.hair }]}>
                <Text style={[styles.timeVal, { color: colors.t1 }]}>22:00</Text>
              </View>
            </View>
            <View style={styles.timePickerCol}>
              <Text style={[styles.infoLabel, { color: colors.t2 }]}>TO</Text>
              <View style={[styles.timeBox, { backgroundColor: colors.surface, borderColor: colors.hair }]}>
                <Text style={[styles.timeVal, { color: colors.t1 }]}>06:00</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* SIGN OUT */}
      <TouchableOpacity 
        style={[styles.signOutBtn, { borderColor: colors.frame }]} 
        onPress={handleSignOut}
        activeOpacity={0.7}>
        <Text style={[styles.signOutText, { color: colors.t2 }]}>Sign Out</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rowTitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
  },
  rowSub: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    marginTop: 2,
  },
  monoSub: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    marginTop: 2,
  },
  
  // Pill Toggle
  pillTrack: {
    width: 42,
    height: 24,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
  },
  pillKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },

  // Info Row (Device)
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
  },
  infoValue: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 13,
  },
  statusValContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Telegram Code Block
  disconnectBtn: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disconnectText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
  },
  telegramBox: {
    paddingVertical: 8,
  },
  instructionText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 20,
  },
  codeBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  codeText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 14,
  },
  copyText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
  },
  outlineBtn: {
    height: 42,
    borderWidth: 1,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outlineBtnText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
  },

  // Quiet Hours
  quietExpandedBox: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  timePickerCol: {
    flex: 1,
    gap: 8,
  },
  timeBox: {
    height: 40,
    borderWidth: 1,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeVal: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 14,
  },

  // Sign Out
  signOutBtn: {
    height: 44,
    borderWidth: 1,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  signOutText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
  },
});
