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
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

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

  const calculateDuration = (index: number) => {
    if (index >= allEvents.length - 1) return '---';
    const current = new Date(allEvents[index].detected_at).getTime();
    const prev = new Date(allEvents[index + 1].detected_at).getTime();
    const diffMins = Math.floor((current - prev) / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hrs}h ${mins}m`;
  };

  const totalPages = Math.ceil(allEvents.length / itemsPerPage);
  const currentEvents = allEvents.slice((page - 1) * itemsPerPage, page * itemsPerPage);

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
        <Text style={[styles.headerCell, styles.col1, { color: colors.t3 }]}>TIME ↑↓</Text>
        <Text style={[styles.headerCell, styles.col2, { color: colors.t3 }]}>EVENT</Text>
        <Text style={[styles.headerCell, styles.col3, { color: colors.t3 }]}>DUR ↑↓</Text>
      </View>

      {/* Table Rows */}
      {currentEvents.length > 0 ? (
        currentEvents.map((event, index) => {
          const globalIndex = (page - 1) * itemsPerPage + index;
          const isArrived = event.event_type === 'arrived';
          return (
            <View key={event.id} style={[styles.tableRow, { borderBottomColor: colors.divider }]}>
              {/* Col 1 */}
              <View style={styles.col1}>
                <Text style={[styles.timeText, { color: colors.t1 }]}>{formatTime(event.detected_at)}</Text>
                <Text style={[styles.dateText, { color: colors.t4 }]}>{formatDate(event.detected_at)}</Text>
              </View>
              {/* Col 2 */}
              <View style={[styles.col2, styles.eventCol]}>
                <View style={[styles.eventDot, { backgroundColor: isArrived ? colors.accent : colors.alert }]} />
                <Text style={[styles.eventLabel, { color: colors.t1 }]}>
                  {isArrived ? 'Water arrived' : 'Water stopped'}
                </Text>
              </View>
              {/* Col 3 */}
              <View style={styles.col3}>
                <Text style={[styles.durText, { color: colors.t2 }]}>{calculateDuration(globalIndex)}</Text>
              </View>
            </View>
          )
        })
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.t3 }]}>No events recorded yet.</Text>
        </View>
      )}

      {/* Pagination Row */}
      {allEvents.length > 0 && (
        <View style={styles.paginationRow}>
          <TouchableOpacity 
            disabled={page === 1} 
            onPress={() => setPage(p => Math.max(1, p - 1))}
          >
            <Text style={[styles.pageButton, { color: page === 1 ? colors.disabled : colors.t1 }]}>← Prev</Text>
          </TouchableOpacity>
          <Text style={[styles.pageIndicator, { color: colors.t3 }]}>Page {page} of {totalPages || 1}</Text>
          <TouchableOpacity 
            disabled={page === totalPages} 
            onPress={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            <Text style={[styles.pageButton, { color: page === totalPages ? colors.disabled : colors.t1 }]}>Next →</Text>
          </TouchableOpacity>
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
