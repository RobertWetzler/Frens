import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, View, TouchableOpacity, Text, Modal, ScrollView, Animated, Platform } from 'react-native';
import { CalendarBody, CalendarContainer, CalendarHeader } from '@howljs/calendar-kit';
import AnimatedBackground from '../components/AnimatedBackground';
import { useApi } from 'hooks/useApi';
import type { EventDto } from 'services/generated/generatedClient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { MyEventsResponse } from 'services/generated/generatedClient';

const CalendarScreen = () => {
  const { data: myEvents, isLoading } = useApi<MyEventsResponse>(
    (client, signal) => client.event_GetMyEvents(1, 100, signal),
    undefined,
    { immediate: true }
  );

  // Lazy subscription API call (only executes when user requests)
  const {
    refetch: refetchSubscribe,
    data: subscriptionRaw,
    isLoading: isSubscribing,
    error: subscribeError,
  } = useApi<string>(
    (client, signal) => client.event_SubscribeToICalendar(signal),
    undefined,
    { immediate: false }
  );

  const { theme } = useTheme();
  const styles = useStyles();
  const [subscriptionUrl, setSubscriptionUrl] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [hasTriedFetch, setHasTriedFetch] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [slideAnim] = useState(new Animated.Value(-110));

  // Initialize subscription URL from API composite response
  useEffect(() => {
    if (myEvents?.calendarSubscriptionUrl) {
      setSubscriptionUrl(myEvents.calendarSubscriptionUrl);
    }
  }, [myEvents?.calendarSubscriptionUrl]);

  // When raw subscription response arrives (after user action), set directly
  useEffect(() => {
    if (subscriptionRaw) {
      setSubscriptionUrl(subscriptionRaw);
    }
  }, [subscriptionRaw]);

  // Build URL no longer needed (server returns full URL); retained for safety
  const buildIcsUrl = (resp: string) => resp;

  const openModal = () => {
    setModalVisible(true);
    setCopyStatus('idle');
    if (!subscriptionUrl && !hasTriedFetch) {
      setHasTriedFetch(true);
      refetchSubscribe();
    }
  };
  // Animate banner in once mounted (if needed)
  useEffect(() => {
    if (!subscriptionUrl && !bannerDismissed) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [subscriptionUrl, bannerDismissed, slideAnim]);

  const dismissBanner = () => {
    Animated.timing(slideAnim, {
      toValue: -110,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setBannerDismissed(true));
  };

  const closeModal = () => setModalVisible(false);

  const handleCopy = async () => {
    if (!subscriptionUrl) return;
    await Clipboard.setStringAsync(subscriptionUrl);
    setCopyStatus('copied');
    setTimeout(() => setCopyStatus('idle'), 2500);
  };

  const handleShare = async () => {
    if (!subscriptionUrl) return;
    try {
      await Share.share({ message: subscriptionUrl });
    } catch (_) {
      // ignore
    }
  };

  // Map API events to Calendar Kit event format
  const calendarEvents = useMemo(() => {
    return (myEvents?.events ?? []).map((e) => ({
      id: e.id ?? String(Math.random()),
      title: e.title ?? 'Untitled',
      start: { dateTime: (e.startDateTime ?? new Date()).toISOString() },
      end: { dateTime: (e.endDateTime ?? e.startDateTime ?? new Date()).toISOString() },
      color: theme.colors.primary,
      isAllDay: !!e.isAllDay,
    }));
  }, [myEvents?.events, theme.colors.primary]);

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
      {/* Gradient banner styled like PWAInstallBanner */}
      {!subscriptionUrl && !bannerDismissed && (
        <Animated.View
          style={[styles.bannerContainer, { transform: [{ translateY: slideAnim }] }]}
          accessibilityRole="alert"
        >
          <LinearGradient
            colors={(theme.gradients?.primary || ['#4F46E5', '#7C3AED']) as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.bannerGradient}
          >
            <View style={styles.bannerContent}>
              <View style={styles.bannerIconContainer}>
                <Ionicons name="calendar-outline" size={20} color="white" />
              </View>
              <View style={styles.bannerTextBlock}>
                <Text style={styles.bannerTitle}>Add Your Cliq Calendar</Text>
                <Text style={styles.bannerSubtitle}>Sync events to Google, Apple & Outlook</Text>
              </View>
              <View style={styles.bannerButtons}>
                <TouchableOpacity
                  style={styles.bannerPrimaryBtn}
                  onPress={openModal}
                  accessibilityLabel="Open calendar subscription instructions"
                >
                  <Text style={styles.bannerPrimaryBtnText}>Subscribe</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.bannerDismissBtn}
                  onPress={dismissBanner}
                  accessibilityLabel="Dismiss calendar subscription banner"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={16} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      )}
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

      {/* Subscription Modal styled like PWAInstallModal */}
      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={closeModal}
          >
            <View style={styles.modalContainer}>
              <TouchableOpacity activeOpacity={1} onPress={() => {}}>
                <LinearGradient
                  colors={(theme.gradients?.accent || theme.gradients?.primary || ['#4F46E5', '#7C3AED']) as any}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalGradient}
                >
                  <View style={styles.modalHeader}>
                    <View style={styles.modalTitleRow}>
                      <Ionicons name="calendar-outline" size={24} color="white" />
                      <Text style={styles.modalTitleText}>Subscribe Calendar</Text>
                    </View>
                    <TouchableOpacity onPress={closeModal} style={styles.modalCloseBtn} accessibilityLabel="Close subscription modal">
                      <Ionicons name="close" size={24} color="white" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.modalSubtitle}>
                    Add your Cliq events to any calendar app:
                  </Text>
                  <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                    {isSubscribing && !subscriptionUrl && (
                      <Text style={styles.modalLoadingText}>Generating secure feed link…</Text>
                    )}
                    {subscribeError && !subscriptionUrl && (
                      <Text style={styles.modalErrorText}>Could not generate link. Please try again.</Text>
                    )}
                    {!!subscriptionUrl && (
                      <View style={styles.feedBlock}>
                        <Text style={styles.feedLabel}>iCal Feed URL</Text>
                        <Text selectable style={styles.feedValue}>{subscriptionUrl}</Text>
                        <View style={styles.feedActions}>
                          <TouchableOpacity style={styles.feedBtn} onPress={handleCopy} accessibilityLabel="Copy iCal URL">
                            <Text style={styles.feedBtnText}>{copyStatus === 'copied' ? 'Copied!' : 'Copy'}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.feedBtn} onPress={handleShare} accessibilityLabel="Share iCal URL">
                            <Text style={styles.feedBtnText}>Share</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                    <View style={styles.stepSection}>
                      <Text style={styles.stepHeader}>Instructions</Text>
                      <View style={styles.stepItem}> <Ionicons name="logo-google" size={18} color="white" style={styles.stepIcon} /> <Text style={styles.stepText}>Google Web: Left sidebar → "+" next to Other calendars → "From URL" → paste link.</Text></View>
                      <View style={styles.stepItem}> <Ionicons name="logo-apple" size={18} color="white" style={styles.stepIcon} /> <Text style={styles.stepText}>Apple macOS: Calendar app → File → New Calendar Subscription… paste link → OK.</Text></View>
                      <View style={styles.stepItem}> <Ionicons name="logo-apple" size={18} color="white" style={styles.stepIcon} /> <Text style={styles.stepText}>Apple iOS: Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar → paste link.</Text></View>
                      <View style={styles.stepItem}> <Ionicons name="logo-microsoft" size={18} color="white" style={styles.stepIcon} /> <Text style={styles.stepText}>Outlook: Calendar → Add Calendar → Subscribe from web (or From Internet) → paste link.</Text></View>
                    </View>
                    <View style={styles.infoSection}>
                      <Text style={styles.infoHeader}>Privacy & Updates</Text>
                      <Text style={styles.infoText}>Treat this URL as private. Apps refresh on their own schedules; changes may take several minutes to appear.</Text>
                    </View>
                  </ScrollView>
                  <View style={styles.modalFooterArea}>
                    <TouchableOpacity
                      style={styles.footerCloseBtn}
                      onPress={closeModal}
                      accessibilityLabel="Close instructions"
                    >
                      <Text style={styles.footerCloseBtnText}>Got it</Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
};
const useStyles = makeStyles(theme => ({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  bannerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1001,
    backgroundColor: 'transparent',
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  bannerGradient: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 66,
    justifyContent: 'center',
  },
  bannerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bannerIconContainer: { marginRight: 12 },
  bannerTextBlock: { flex: 1, marginRight: 12 },
  bannerTitle: { color: theme.colors.primaryContrast, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  bannerSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 14 },
  bannerButtons: { flexDirection: 'row', alignItems: 'center' },
  bannerPrimaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  bannerPrimaryBtnText: { color: theme.colors.primaryContrast, fontSize: 12, fontWeight: '600' },
  bannerDismissBtn: { padding: 8, borderRadius: 12, minWidth: 24, minHeight: 24, alignItems: 'center', justifyContent: 'center' },
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
  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center', alignItems: 'center', zIndex: 9999,
  },
  modalOverlayTouchable: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
  modalContainer: { width: '90%', maxWidth: 420, maxHeight: '85%' },
  modalGradient: {
    borderRadius: 18, padding: 26,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center' },
  modalTitleText: { fontSize: 20, fontWeight: 'bold', color: theme.colors.primaryContrast, marginLeft: 8 },
  modalCloseBtn: { padding: 4 },
  modalSubtitle: { fontSize: 16, color: 'rgba(255,255,255,0.9)', marginBottom: 20, lineHeight: 22 },
  modalScroll: { maxHeight: 360 },
  modalLoadingText: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginBottom: 14 },
  modalErrorText: { fontSize: 14, color: '#FFB4B4', marginBottom: 14 },
  feedBlock: { marginBottom: 20, padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)' },
  feedLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginBottom: 6 },
  feedValue: { fontSize: 13, color: '#FFF' },
  feedActions: { flexDirection: 'row', marginTop: 12 },
  feedBtn: { backgroundColor: 'rgba(255,255,255,0.22)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  feedBtnText: { color: theme.colors.primaryContrast, fontSize: 12, fontWeight: '600' },
  stepSection: { marginBottom: 22 },
  stepHeader: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.95)', marginBottom: 12 },
  stepItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  stepIcon: { marginRight: 8, marginTop: 2 },
  stepText: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 18 },
  infoSection: { marginBottom: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.25)' },
  infoHeader: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.95)', marginBottom: 8 },
  infoText: { fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 18 },
  modalFooterArea: { marginTop: 24 },
  footerCloseBtn: { backgroundColor: 'rgba(255,255,255,0.25)', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 26, alignSelf: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  footerCloseBtnText: { color: theme.colors.primaryContrast, fontSize: 16, fontWeight: '600' },
}));

export default CalendarScreen;