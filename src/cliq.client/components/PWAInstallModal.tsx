import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';

interface PWAInstallModalProps {
  visible: boolean;
  onClose: () => void;
  platform: 'ios' | 'android' | 'desktop' | 'other';
}

const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ visible, onClose, platform }) => {
  const getInstructions = () => {
    switch (platform) {
      case 'ios':
        return [
          {
            step: 1,
            text: 'Tap the Share button at the bottom',
            icon: 'share-outline' as const,
          },
          {
            step: 2,
            text: 'Scroll down and select "Add to Home Screen"',
            icon: 'add-circle-outline' as const,
          },
          {
            step: 3,
            text: 'Tap "Add" in the top right',
            icon: 'checkmark-circle-outline' as const,
          },
        ];
      case 'android':
        return [
          {
            step: 1,
            text: 'Tap the menu in your browser',
            icon: 'menu-outline' as const,
          },
          {
            step: 2,
            text: 'Select "Add to Home screen" or "Install app"',
            icon: 'download-outline' as const,
          },
          {
            step: 3,
            text: 'Tap "Install" when prompted',
            icon: 'checkmark-circle-outline' as const,
          },
        ];
      case 'desktop':
        return [
          {
            step: 1,
            text: 'Look for the install icon in your address bar',
            icon: 'download-outline' as const,
          },
          {
            step: 2,
            text: 'Click it and select "Install"',
            icon: 'desktop-outline' as const,
          },
          {
            step: 3,
            text: 'Or use Chrome menu > "Install Frens..."',
            icon: 'ellipsis-vertical-outline' as const,
          },
        ];
      default:
        return [
          {
            step: 1,
            text: 'Look for an install option in your browser menu',
            icon: 'search-outline' as const,
          },
          {
            step: 2,
            text: 'Check your address bar for an install icon',
            icon: 'location-outline' as const,
          },
          {
            step: 3,
            text: 'Follow your browser\'s installation prompts',
            icon: 'arrow-forward-circle-outline' as const,
          },
        ];
    }
  };

  const instructions = getInstructions();
  const platformName = platform === 'ios' ? 'iOS Safari' : 
                      platform === 'android' ? 'Android Chrome' :
                      platform === 'desktop' ? 'Desktop Chrome' : 'Your Browser';

  if (!visible) {
    return null;
  }

  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        >
          <View style={styles.modalContainer}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <LinearGradient
                colors={(theme.gradients?.accent || ['#4F46E5', '#7C3AED']) as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modalContent}
              >
                <View style={styles.header}>
                  <View style={styles.titleContainer}>
                    <Ionicons name="phone-portrait-outline" size={24} color="white" />
                    <Text style={styles.title}>Install Frens</Text>
                  </View>
                  <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Ionicons name="close" size={24} color="white" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.subtitle}>
                  Follow these steps to install on {platformName}:
                </Text>

                <ScrollView style={styles.instructionsContainer} showsVerticalScrollIndicator={false}>
                  {instructions.map((instruction) => (
                    <View key={instruction.step} style={styles.instructionItem}>
                      <View style={styles.stepIndicator}>
                        <Text style={styles.stepNumber}>{instruction.step}</Text>
                      </View>
                      <View style={styles.instructionContent}>
                        <Ionicons 
                          name={instruction.icon} 
                          size={20} 
                          color="rgba(255, 255, 255, 0.9)" 
                          style={styles.instructionIcon}
                        />
                        <Text style={styles.instructionText}>{instruction.text}</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>

                <View style={styles.footer}>
                  <Text style={styles.footerText}>
                    After installation, you'll get notifications!
                  </Text>
                  <TouchableOpacity 
                    style={styles.gotItButton}
                    onPress={onClose}
                  >
                    <Text style={styles.gotItButtonText}>Got it!</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

// makeStyles at bottom
const useStyles = makeStyles((theme) => ({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center', alignItems: 'center', zIndex: 9999,
  },
  overlayTouchable: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
  modalContainer: { width: '90%', maxWidth: 400, maxHeight: '80%' },
  modalContent: {
    borderRadius: 16, padding: 24,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  titleContainer: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', color: theme.colors.primaryContrast, marginLeft: 8 },
  closeButton: { padding: 4 },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.9)', marginBottom: 20, lineHeight: 22 },
  instructionsContainer: { maxHeight: 300 },
  instructionItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  stepIndicator: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2,
  },
  stepNumber: { fontSize: 14, fontWeight: 'bold', color: theme.colors.primaryContrast },
  instructionContent: { flex: 1, flexDirection: 'row', alignItems: 'flex-start' },
  instructionIcon: { marginRight: 8, marginTop: 2 },
  instructionText: { flex: 1, fontSize: 15, color: 'rgba(255,255,255,0.9)', lineHeight: 20 },
  footer: { marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  footerText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginBottom: 16, lineHeight: 18 },
  gotItButton: {
    backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 25,
    alignSelf: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  gotItButtonText: { color: theme.colors.primaryContrast, fontSize: 16, fontWeight: '600', textAlign: 'center' },
}));

export default PWAInstallModal;
