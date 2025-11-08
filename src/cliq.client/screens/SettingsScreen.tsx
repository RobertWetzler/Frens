import React, { useEffect, useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';
import { useApi } from 'hooks/useApi';
import type { MyEventsResponse } from 'services/generated/generatedClient';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';

const SettingsScreen: React.FC<any> = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = useStyles();
  const { data: myEventsData, isLoading: isLoadingEvents, refetch } = useApi<MyEventsResponse>(
    (client, signal) => client.event_GetMyEvents(1, 20, signal),
    undefined,
    { immediate: true }
  );

  const { data: subscribeData, isLoading: isSubscribing, refetch: refetchSubscribe } = useApi<string>(
    (client, signal) => client.event_SubscribeToICalendar(signal),
    undefined,
    { immediate: false }
  );

  const [icalUrl, setIcalUrl] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  useEffect(() => {
    if (myEventsData?.calendarSubscriptionUrl) {
      setIcalUrl(myEventsData.calendarSubscriptionUrl);
    }
  }, [myEventsData?.calendarSubscriptionUrl]);

  useEffect(() => {
    if (subscribeData) {
      setIcalUrl(subscribeData);
    }
  }, [subscribeData]);

  const handleCopy = async () => {
    if (!icalUrl) return;
    await Clipboard.setStringAsync(icalUrl);
    setCopyStatus('copied');
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

  const handleShare = async () => {
    if (!icalUrl) return;
    try { await Share.share({ message: icalUrl }); } catch { /* ignore */ }
  };

  const handleReset = () => {
    refetchSubscribe();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.screenTitle}>Settings</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Calendar Subscription</Text>
          {isLoadingEvents && !icalUrl && (
            <View style={styles.inlineLoading}><ActivityIndicator size="small" color={theme.colors.primary} /></View>
          )}
          {icalUrl ? (
            <View style={styles.card}>
              <Text style={styles.label}>iCal Feed URL</Text>
              <Text selectable style={styles.value}>{icalUrl}</Text>
              <View style={styles.rowActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={handleCopy} accessibilityLabel="Copy calendar link">
                  <Text style={styles.actionBtnText}>{copyStatus === 'copied' ? 'Copied!' : 'Copy'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={handleShare} accessibilityLabel="Share calendar link">
                  <Text style={styles.actionBtnText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.resetBtn]} onPress={handleReset} accessibilityLabel="Reset calendar subscription">
                  {isSubscribing ? (
                    <ActivityIndicator size={16} color={theme.colors.primaryContrast} />
                  ) : (
                    <Text style={styles.actionBtnText}>Reset</Text>
                  )}
                </TouchableOpacity>
              </View>
              <Text style={styles.helpText}>Reset will generate a new private URL. Previous one stops updating.</Text>
              <Text style={styles.instructions}>
                Add to Google: Other calendars → + → From URL.{'\n'}
                Apple macOS: Calendar → File → New Calendar Subscription.{'\n'}
                Apple iOS: Settings → Calendar → Accounts → Other → Add Subscribed Calendar.{'\n'}
                Outlook: Add Calendar → Subscribe from web.
              </Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.subscribeCta} onPress={handleReset} disabled={isSubscribing}>
              {isSubscribing ? (
                <ActivityIndicator size={20} color={theme.colors.primaryContrast} />
              ) : (
                <>
                  <Ionicons name="calendar-outline" size={20} color={theme.colors.primaryContrast} />
                  <Text style={styles.subscribeCtaText}>Generate Calendar Link</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      <TouchableOpacity style={styles.closeFab} onPress={() => navigation.goBack()} accessibilityLabel="Close settings">
        <Ionicons name="close" size={26} color={theme.colors.primaryContrast} />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const useStyles = makeStyles(theme => ({
  container: { flex: 1, backgroundColor: theme.colors.backgroundAlt },
  content: { padding: 20, paddingBottom: 120 },
  screenTitle: { fontSize: 28, fontWeight: '800', letterSpacing: 0.5, marginBottom: 28, color: theme.colors.textPrimary },
  section: { marginBottom: 48 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 14, color: theme.colors.textPrimary, letterSpacing: 0.3 },
  inlineLoading: { flexDirection: 'row', alignItems: 'center' },
  card: { backgroundColor: theme.colors.card, padding: 18, borderRadius: 16, shadowColor: theme.colors.shadow, shadowOpacity: 0.1, shadowRadius: 8, borderWidth: 1, borderColor: theme.colors.separator },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: theme.colors.textSecondary, marginBottom: 6, letterSpacing: 0.8 },
  value: { fontSize: 14, color: theme.colors.textPrimary, fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }), backgroundColor: theme.colors.backgroundAlt, padding: 8, borderRadius: 8, overflow: 'hidden' },
  rowActions: { flexDirection: 'row', marginTop: 16, flexWrap: 'wrap' },
  actionBtn: { backgroundColor: theme.colors.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, marginRight: 12, marginBottom: 12, shadowColor: theme.colors.shadow, shadowOpacity: 0.12, shadowRadius: 6 },
  resetBtn: { backgroundColor: theme.colors.accent || theme.colors.primary },
  actionBtnText: { color: theme.colors.primaryContrast, fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
  helpText: { marginTop: 10, fontSize: 12, color: theme.colors.textSecondary, fontStyle: 'italic' },
  instructions: { marginTop: 14, fontSize: 13, lineHeight: 20, color: theme.colors.textSecondary },
  subscribeCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary, paddingVertical: 16, borderRadius: 14, shadowColor: theme.colors.shadow, shadowOpacity: 0.15, shadowRadius: 8 },
  subscribeCtaText: { marginLeft: 10, color: theme.colors.primaryContrast, fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },
  closeFab: { position: 'absolute', bottom: 30, right: 24, backgroundColor: theme.colors.primary, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: theme.colors.shadow, shadowOpacity: 0.25, shadowRadius: 8 },
}));

export default SettingsScreen;
