import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Post from './Post';
import { EventDto, RsvpStatus } from 'services/generated/generatedClient';

interface EventProps {
  event: EventDto;
  navigation?: any;
  isNavigable?: boolean;
  animationDelay?: number;
  shouldAnimate?: boolean;
}

const formatDateTime = (dt?: Date) => {
  if (!dt) return '';
  const date = new Date(dt);
  const now = new Date();
  const isCurrentYear = now.getFullYear() === date.getFullYear();
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  if (!isCurrentYear) options.year = 'numeric';
  return date.toLocaleString('en-US', options);
};

const Event: React.FC<EventProps> = ({ event, navigation, isNavigable = true, animationDelay = 0, shouldAnimate = false }) => {
  const hasEnd = !!event.endDateTime;
  const when = hasEnd
    ? `${formatDateTime(event.startDateTime)} – ${formatDateTime(event.endDateTime!)}`
    : `${formatDateTime(event.startDateTime)}`;

  const showLocation = !!event.location;
  const showTimezone = !!event.timezone;
  const showMax = typeof event.maxAttendees === 'number' && event.maxAttendees! > 0;
  const showRecurrence = !!event.isRecurring && !!event.recurrenceRule;
  const hasRsvpCounts = [event.goingCount, event.maybeCount, event.notGoingCount].some(v => typeof v === 'number');

  // Left date badge (month + day)
  const start = event.startDateTime ? new Date(event.startDateTime) : undefined;
  const month = start ? start.toLocaleString('en-US', { month: 'short' }).toUpperCase() : '';
  const day = start ? String(start.getDate()) : '';

  const pre = (
    <View style={styles.row}>
      <View style={styles.dateBadge}>
        <Text style={styles.dateMonth}>{month}</Text>
        <Text style={styles.dateDay}>{day}</Text>
      </View>
      <View style={styles.headerCol}> 
        {event.title ? <Text style={styles.title}>{event.title}</Text> : null}
        <Text style={styles.whenLine}>{when}</Text>
        {showLocation && (
          <View style={styles.metaRow}>
            <Text style={styles.metaEmoji}>📍</Text>
            <Text style={styles.metaText}>{event.location}</Text>
          </View>
        )}
        {/* {showTimezone && (
          <View style={styles.metaRow}>
            <Text style={styles.metaEmoji}>🕰️</Text>
            <Text style={styles.metaText}>{event.timezone}</Text>
          </View>
        )} */}
        {showMax && (
          <View style={styles.metaRow}>
            <Text style={styles.metaEmoji}>👥</Text>
            <Text style={styles.metaText}>Max {event.maxAttendees}</Text>
          </View>
        )}
        {showRecurrence && (
          <View style={styles.metaRow}>
            <Text style={styles.metaEmoji}>🔁</Text>
            <Text style={styles.metaText}>{event.recurrenceRule}</Text>
          </View>
        )}
      </View>
    </View>
  );

  const footer = (<></>
    // <View style={styles.footerWrap}>
    //   <View style={styles.rsvpButtonsRow}>
    //     <TouchableOpacity style={[styles.rsvpButton, styles.rsvpPrimary]}> 
    //       <Text style={[styles.rsvpButtonText, styles.rsvpPrimaryText]}>Going</Text>
    //     </TouchableOpacity>
    //     <TouchableOpacity style={styles.rsvpButton}> 
    //       <Text style={styles.rsvpButtonText}>Maybe</Text>
    //     </TouchableOpacity>
    //     <TouchableOpacity style={styles.rsvpButton}> 
    //       <Text style={styles.rsvpButtonText}>Can’t</Text>
    //     </TouchableOpacity>
    //   </View>
    //   <View style={styles.footerCountsRow}>
    //     {/* {typeof event.goingCount === 'number' && (
    //       <Text style={styles.countLink}>{event.goingCount} going</Text>
    //     )} }
    //     {typeof event.commentCount === 'number' && (
    //       <Text style={styles.countLink}>{event.commentCount} comments</Text>
    //     )} */}
    //   </View>
    // </View>
  );

  return (
    <Post
      post={event}
      navigation={navigation}
      isNavigable={isNavigable}
      animationDelay={animationDelay}
      shouldAnimate={shouldAnimate}
      renderPreContent={pre}
      renderFooterContent={footer}
      showDefaultCommentButton={true}
    />
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 8 },
  dateBadge: {
    width: 48,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e1e8ed',
  },
  dateMonth: {
    backgroundColor: '#2F80ED',
    color: 'white',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
    paddingVertical: 4,
  },
  dateDay: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    paddingVertical: 2,
    color: '#111',
    backgroundColor: 'white',
  },
  headerCol: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 2 },
  whenLine: { fontSize: 14, color: '#111', marginBottom: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaEmoji: { fontSize: 13 },
  metaText: { fontSize: 13, color: '#444' },
  footerWrap: { marginTop: 2 },
  rsvpButtonsRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  rsvpButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cde3fb',
    backgroundColor: 'white',
    alignItems: 'center',
  },
  rsvpPrimary: { backgroundColor: '#1DA1F2', borderColor: '#1DA1F2' },
  rsvpButtonText: { color: '#1DA1F2', fontWeight: '700' },
  rsvpPrimaryText: { color: 'white' },
  footerCountsRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  countLink: { color: '#1DA1F2', fontSize: 14 },
});

export default Event;
