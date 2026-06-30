import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useDevice } from '@/hooks/use-device';
import { useTheme } from '@/theme/ThemeContext';

export default function HistoryScreen() {
  const { allEvents, loading, refresh } = useDevice();
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [sortKey, setSortKey] = useState<'time' | 'dur'>('time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

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

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };
  
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDurationString = (mins: number) => {
    if (mins <= 0) return '---';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hrs}h ${remainingMins}m`;
  };

  // 1. Calculate durations based on original chronological order (descending by detected_at)
  const chronologicalEvents = React.useMemo(() => {
    return [...allEvents].sort(
      (a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime()
    );
  }, [allEvents]);

  const eventsWithDuration = React.useMemo(() => {
    return chronologicalEvents.map((event, idx) => {
      let durMins = 0;
      if (idx < chronologicalEvents.length - 1) {
        const current = new Date(event.detected_at).getTime();
        const prev = new Date(chronologicalEvents[idx + 1].detected_at).getTime();
        durMins = Math.max(0, Math.floor((current - prev) / 60000));
      }
      return {
        ...event,
        duration: durMins,
      };
    });
  }, [chronologicalEvents]);

  // 2. Sort events according to sortKey and sortDir
  const sortedEvents = React.useMemo(() => {
    return [...eventsWithDuration].sort((a, b) => {
      let av = 0;
      let bv = 0;
      if (sortKey === 'dur') {
        av = a.duration;
        bv = b.duration;
      } else {
        av = new Date(a.detected_at).getTime();
        bv = new Date(b.detected_at).getTime();
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [eventsWithDuration, sortKey, sortDir]);

  const handleSort = (key: 'time' | 'dur') => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const timeArrow = sortKey === 'time' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';
  const durArrow = sortKey === 'dur' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

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
      
      {/* Table Header */}
      <View style={[styles.tableHeader, { borderBottomColor: colors.hair }]}>
        <TouchableOpacity style={styles.col1} onPress={() => handleSort('time')} activeOpacity={0.7}>
          <Text style={[styles.headerCell, { color: colors.t3 }]}>TIME{timeArrow}</Text>
        </TouchableOpacity>
        <View style={styles.col2}>
          <Text style={[styles.headerCell, { color: colors.t3 }]}>EVENT</Text>
        </View>
        <TouchableOpacity style={styles.col3} onPress={() => handleSort('dur')} activeOpacity={0.7}>
          <Text style={[styles.headerCell, { color: colors.t3, textAlign: 'right' }]}>DUR{durArrow}</Text>
        </TouchableOpacity>
      </View>

      {/* Table Rows */}
      {sortedEvents.length > 0 ? (
        sortedEvents.map((event) => {
          const type = event.event_type;
          
          let dotColor = colors.alert;
          let eventLabelText = 'Water stopped';
          
          if (type === 'arrived') {
            dotColor = colors.accent;
            eventLabelText = 'Water arrived';
          } else if (type === 'heartbeat') {
            dotColor = colors.warning;
            eventLabelText = 'Heartbeat';
          } else if (type === 'stopped') {
            dotColor = colors.alert;
            eventLabelText = 'Water stopped';
          }

          return (
            <View key={event.id} style={[styles.tableRow, { borderBottomColor: colors.divider }]}>
              {/* Col 1 */}
              <View style={styles.col1}>
                <Text style={[styles.timeText, { color: colors.t1 }]}>{formatTime(event.detected_at)}</Text>
                <Text style={[styles.dateText, { color: colors.t4 }]}>{formatDate(event.detected_at)}</Text>
              </View>
              {/* Col 2 */}
              <View style={[styles.col2, styles.eventCol]}>
                <View style={[styles.eventDot, { backgroundColor: dotColor }]} />
                <Text style={[styles.eventLabel, { color: colors.t1 }]}>
                  {eventLabelText}
                </Text>
              </View>
              {/* Col 3 */}
              <View style={styles.col3}>
                <Text style={[styles.durText, { color: colors.t2 }]}>{formatDurationString(event.duration)}</Text>
              </View>
            </View>
          )
        })
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.t3 }]}>No events recorded yet.</Text>
        </View>
      )}
      
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
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Table Layout
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingBottom: 10,
    marginBottom: 0, // Rows handle their own padding
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerCell: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  col1: {
    width: 92,
    paddingRight: 10,
  },
  col2: {
    flex: 1,
    paddingRight: 10,
  },
  col3: {
    width: 72,
    textAlign: 'right',
    alignItems: 'flex-end',
  },

  // Cell Content
  timeText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 13,
  },
  dateText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 10,
    marginTop: 2,
  },
  eventCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  eventLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
  },
  durText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
  },

  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
  },

  // Pagination
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 26,
  },
  pageButton: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
  },
  pageIndicator: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 12,
  },
});
