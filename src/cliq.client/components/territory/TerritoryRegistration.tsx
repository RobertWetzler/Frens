import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { makeStyles } from '../../theme/makeStyles';
import { TERRITORY_COLORS } from 'services/territoryGame';

interface TerritoryRegistrationProps {
  onRegister: (color: string) => Promise<void>;
}

const TerritoryRegistration: React.FC<TerritoryRegistrationProps> = ({ onRegister }) => {
  const { theme } = useTheme();
  const styles = useStyles();
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async () => {
    if (!selectedColor || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onRegister(selectedColor);
    } catch {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.emoji}>🗺️</Text>
        <Text style={styles.title}>FrenZones</Text>
        <Text style={styles.subtitle}>Paint the map. Rep your crew.</Text>
      </View>

      {/* Instructions */}
      <View style={styles.instructionsCard}>
        <Text style={styles.instructionsTitle}>How to Play</Text>

        <View style={styles.instructionRow}>
          <View style={[styles.instructionIcon, { backgroundColor: '#E8F5E9' }]}>
            <Ionicons name="location" size={20} color="#4CAF50" />
          </View>
          <View style={styles.instructionText}>
            <Text style={styles.instructionBold}>Stand in your cell</Text>
            <Text style={styles.instructionDesc}>
              The map is divided into ~500 sq ft cells. You can only claim the cell you're standing in.
            </Text>
          </View>
        </View>

        <View style={styles.instructionRow}>
          <View style={[styles.instructionIcon, { backgroundColor: '#E3F2FD' }]}>
            <Ionicons name="flag" size={20} color="#2196F3" />
          </View>
          <View style={styles.instructionText}>
            <Text style={styles.instructionBold}>Claim territory</Text>
            <Text style={styles.instructionDesc}>
              Tap to paint the cell with your color. You can claim one cell every 60 seconds.
            </Text>
          </View>
        </View>

        <View style={styles.instructionRow}>
          <View style={[styles.instructionIcon, { backgroundColor: '#FFF3E0' }]}>
            <Ionicons name="trophy" size={20} color="#FF9800" />
          </View>
          <View style={styles.instructionText}>
            <Text style={styles.instructionBold}>Dominate the leaderboard</Text>
            <Text style={styles.instructionDesc}>
              Claim the most cells to top the leaderboard. Other players can steal your cells!
            </Text>
          </View>
        </View>
      </View>

      {/* Color Picker */}
      <View style={styles.colorSection}>
        <Text style={styles.colorTitle}>Choose Your Color</Text>
        <Text style={styles.colorSubtitle}>This is the color that will represent your zones</Text>
        <View style={styles.colorGrid}>
          {TERRITORY_COLORS.map((color) => (
            <TouchableOpacity
              key={color}
              onPress={() => setSelectedColor(color)}
              style={[
                styles.colorSwatch,
                { backgroundColor: color },
                selectedColor === color && styles.colorSwatchSelected,
                selectedColor === color && { borderColor: theme.colors.textPrimary },
              ]}
            >
              {selectedColor === color && (
                <Ionicons name="checkmark" size={24} color="#FFF" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Start Button */}
      <TouchableOpacity
        style={[
          styles.startButton,
          !selectedColor && styles.startButtonDisabled,
          selectedColor && { backgroundColor: selectedColor },
        ]}
        onPress={handleRegister}
        disabled={!selectedColor || isSubmitting}
      >
        <Ionicons name="flag" size={20} color="#FFF" style={{ marginRight: 8 }} />
        <Text style={styles.startButtonText}>
          {isSubmitting ? 'Joining...' : 'Start Frenning Zones'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const useStyles = makeStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background === 'transparent' ? theme.colors.backgroundAlt : theme.colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 12,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textMuted,
  },
  instructionsCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  instructionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  instructionText: {
    flex: 1,
  },
  instructionBold: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  instructionDesc: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  colorSection: {
    marginBottom: 24,
  },
  colorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  colorSubtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginBottom: 16,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  colorSwatch: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderWidth: 3,
    transform: [{ scale: 1.15 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  startButtonDisabled: {
    backgroundColor: theme.colors.textMuted,
    opacity: 0.5,
  },
  startButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
}));

export default TerritoryRegistration;
