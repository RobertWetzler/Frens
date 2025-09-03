import React, { useMemo, useRef } from 'react';
import { SafeAreaView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { CalendarBody, CalendarContainer, CalendarHeader } from '@howljs/calendar-kit';
import AnimatedBackground from '../components/AnimatedBackground';
import { useApi } from 'hooks/useApi';
import type { EventDto } from 'services/generated/generatedClient';
import { Ionicons } from '@expo/vector-icons';

const CalendarScreen = () => {
  const { data: events, isLoading } = useApi<EventDto[]>(
    (client, signal) => client.event_GetMyEvents(1, 100, signal),
    [],
    { immediate: true }
  );

  // Map API events to Calendar Kit event format
  const calendarEvents = useMemo(() => {
    return (events ?? []).map((e) => ({
      id: e.id ?? String(Math.random()),
      title: e.title ?? 'Untitled',
      start: { dateTime: (e.startDateTime ?? new Date()).toISOString() },
      end: { dateTime: (e.endDateTime ?? e.startDateTime ?? new Date()).toISOString() },
      color: '#1DA1F2',
      isAllDay: !!e.isAllDay,
    }));
  }, [events]);

  const calendarRef = useRef<any>(null);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.calendarWrapper}>
        <CalendarContainer ref={calendarRef} useHaptic={true} events={calendarEvents} isLoading={isLoading}>
          <CalendarHeader />
          <CalendarBody />
        </CalendarContainer>

        {/* Overlay navigation controls (do not affect header layout) */}
        <View style={styles.controlsOverlay} pointerEvents="box-none">
          <TouchableOpacity
            accessibilityLabel="Previous"
            onPress={() => calendarRef.current?.goToPrevPage(true)}
            style={styles.navBtn}
          >
            <Ionicons name="chevron-back" size={20} color="#1DA1F2" />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="Next"
            onPress={() => calendarRef.current?.goToNextPage(true)}
            style={[styles.navBtn, { marginLeft: -10 }]}
          >
            <Ionicons name="chevron-forward" size={20} color="#1DA1F2" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  calendarWrapper: {
    flex: 1,
    position: 'relative',
  },
  controlsOverlay: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  navBtn: {
    padding: 6,
    borderRadius: 8,
    // backgroundColor: 'rgba(255, 255, 255, 0)',
  },
});

export default CalendarScreen;