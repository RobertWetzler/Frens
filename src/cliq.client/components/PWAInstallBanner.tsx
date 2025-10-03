import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import PWAInstallModal from './PWAInstallModal';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';

interface PWAInstallBannerProps {
  onDismiss?: () => void;
  onVisibilityChange?: (isVisible: boolean) => void;
}

const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({ onDismiss, onVisibilityChange }) => {
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [slideAnim] = useState(new Animated.Value(-100));
  const [showModal, setShowModal] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop' | 'other'>('other');
  // THEME HOOKS MUST BE BEFORE ANY CONDITIONAL RETURNS
  const { theme } = useTheme();
  const styles = useStyles();

  // Check if banner was previously dismissed (web only)
  useEffect(() => {
    if (Platform.OS !== 'web') return; // Don't run in native apps
    if (typeof window === 'undefined') return;
    try {
      const wasDismissed = typeof localStorage !== 'undefined' && localStorage.getItem('pwa-banner-dismissed') === 'true';
      setIsDismissed(wasDismissed);
    } catch { /* ignore storage issues */ }

    // Detect platform (for instructional text inside modal)
    const userAgent = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
      setPlatform('ios');
    } else if (/Android/.test(userAgent) && /Chrome/.test(userAgent)) {
      setPlatform('android');
    } else if (/Chrome/.test(userAgent) && !/Mobile/.test(userAgent)) {
      setPlatform('desktop');
    } else {
      setPlatform('other');
    }
  }, []);

  // Check for PWA installation status
  useEffect(() => {
    if (Platform.OS !== 'web') return; // PWA concept irrelevant in native
    if (typeof window === 'undefined') return;
    const checkPWAInstalled = () => {
      try {
        const isStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches || false;
        const isIOSStandalone = (window.navigator as any)?.standalone === true;
        setIsPWAInstalled(isStandalone || isIOSStandalone);
      } catch { /* ignore */ }
    };
    checkPWAInstalled();
    let mediaQuery: MediaQueryList | undefined;
    try {
      mediaQuery = window.matchMedia('(display-mode: standalone)');
      mediaQuery.addEventListener('change', checkPWAInstalled);
    } catch { /* ignore */ }
    return () => {
      try { mediaQuery?.removeEventListener('change', checkPWAInstalled); } catch { /* ignore */ }
    };
  }, []);

  // Notify parent about visibility changes
  useEffect(() => {
    const isVisible = !isPWAInstalled && !isDismissed;
    onVisibilityChange?.(isVisible);
  }, [isPWAInstalled, isDismissed, onVisibilityChange]);

  // Animate banner appearance
  useEffect(() => {
    if (!isPWAInstalled && !isDismissed) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isPWAInstalled, isDismissed, slideAnim]);

  const handleDismiss = () => {
    console.log('PWA banner dismiss button pressed');
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      try { localStorage.setItem('pwa-banner-dismissed', 'true'); } catch { /* ignore */ }
    }
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setIsDismissed(true);
      onDismiss?.();
    });
  };

  const handleInstallClick = () => {
    setShowModal(true);
  };

  // Don't render if PWA is installed or banner is dismissed
  // Never render on native platforms (only meaningful for web PWAs)
  if (Platform.OS !== 'web') return null;
  if (isPWAInstalled || isDismissed) return null;

  return (
    <>
      <PWAInstallModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        platform={platform}
      />
      <Animated.View 
        style={[
          styles.container,
          {
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
      <LinearGradient
        colors={(theme.gradients?.primary || ['#4F46E5', '#7C3AED']) as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="phone-portrait-outline" size={20} color="white" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.title}>Get the full app experience</Text>
            <Text style={styles.subtitle}>Add to homescreen for notifications</Text>
          </View>
          <View style={styles.buttonsContainer}>
            <TouchableOpacity 
              style={styles.installButton}
              onPress={handleInstallClick}
            >
              <Text style={styles.installButtonText}>Install</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.dismissButton}
              onPress={handleDismiss}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={16} color="rgba(255, 255, 255, 0.8)" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
    </>
  );
};

// keep makeStyles at bottom
const useStyles = makeStyles((theme) => ({
  container: {
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
  gradient: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 66,
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconContainer: { marginRight: 12 },
  textContainer: { flex: 1, marginRight: 12 },
  title: { color: theme.colors.primaryContrast, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  subtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 12, lineHeight: 14 },
  buttonsContainer: { flexDirection: 'row', alignItems: 'center' },
  installButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  installButtonText: { color: theme.colors.primaryContrast, fontSize: 12, fontWeight: '600' },
  dismissButton: { padding: 8, borderRadius: 12, minWidth: 24, minHeight: 24, alignItems: 'center', justifyContent: 'center' },
}));

export default PWAInstallBanner;
