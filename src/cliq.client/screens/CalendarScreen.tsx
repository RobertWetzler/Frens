import React, { useMemo, useRef } from 'react';
import { SafeAreaView, View, TouchableOpacity } from 'react-native';
import { CalendarBody, CalendarContainer, CalendarHeader } from '@howljs/calendar-kit';
import AnimatedBackground from '../components/AnimatedBackground';
import { useApi } from 'hooks/useApi';
import type { EventDto } from 'services/generated/generatedClient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';

const CalendarScreen = () => {
  const { data: events, isLoading } = useApi<EventDto[]>(
    (client, signal) => client.event_GetMyEvents(1, 100, signal),
    [],
    { immediate: true }
  );
  const { theme } = useTheme();
  const styles = useStyles();

  // Map API events to Calendar Kit event format
  const calendarEvents = useMemo(() => {
    return (events ?? []).map((e) => ({
      id: e.id ?? String(Math.random()),
      title: e.title ?? 'Untitled',
      start: { dateTime: (e.startDateTime ?? new Date()).toISOString() },
      end: { dateTime: (e.endDateTime ?? e.startDateTime ?? new Date()).toISOString() },
      color: theme.colors.primary,
      isAllDay: !!e.isAllDay,
    }));
  }, [events, theme.colors.primary]);

  const calendarRef = useRef<any>(null);

  // Calendar Kit theme mapping (based on library theme guide assumptions)
  const calendarTheme = useMemo(
    () => ({
      colors: {
        primary: theme.colors.primary,
        onPrimary: theme.colors.primaryContrast || '#FFFFFF',
        background: theme.colors.backgroundAlt,
        onBackground: theme.colors.textPrimary,
        surface: theme.colors.card,
        onSurface: theme.colors.textPrimary,
        border: theme.colors.separator,
        text: theme.colors.textPrimary,
      },
      components: {
        dayCell: {
          today: {
            containerStyle: {
              backgroundColor: theme.colors.accent || theme.colors.primary,
              borderRadius: 8,
            },
            textStyle: { color: theme.colors.primaryContrast || '#FFF' },
          },
          selected: {
            containerStyle: {
              backgroundColor: theme.colors.primary,
              borderRadius: 8,
            },
            textStyle: { color: theme.colors.primaryContrast || '#FFF' },
          },
        },
        eventCell: {
          containerStyle: {
            backgroundColor: theme.colors.primary,
            borderRadius: 6,
          },
          textStyle: { color: theme.colors.primaryContrast || '#FFF' },
        },
      },
    }),
    [theme]
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.calendarWrapper}>
        <View style={{ flex: 1, backgroundColor: calendarTheme.colors?.background }}>
          <CalendarContainer
            ref={calendarRef}
            useHaptic={true}
            events={calendarEvents}
            isLoading={isLoading}
            theme={calendarTheme}
          >
            <CalendarHeader />
            <CalendarBody />
          </CalendarContainer>
        </View>

        {/* Overlay navigation controls (do not affect header layout) */}
        <View style={styles.controlsOverlay} pointerEvents="box-none">
          <TouchableOpacity
            accessibilityLabel="Previous"
            onPress={() => calendarRef.current?.goToPrevPage(true)}
            style={styles.navBtn}
          >
            <Ionicons name="chevron-back" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="Next"
            onPress={() => calendarRef.current?.goToNextPage(true)}
            style={[styles.navBtn, { marginLeft: -10 }]}
          >
            <Ionicons name="chevron-forward" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};
const useStyles = makeStyles(theme => ({
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
  },
}));

export default CalendarScreen;