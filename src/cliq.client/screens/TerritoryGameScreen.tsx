import React, { useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';
import { useTerritoryGame } from 'hooks/useTerritoryGame';
import TerritoryRegistration from 'components/territory/TerritoryRegistration';
import TerritoryMap from 'components/territory/TerritoryMap';
import TerritoryLeaderboard from 'components/territory/TerritoryLeaderboard';
import { TERRITORY_COLORS } from 'services/territoryGame';

type Tab = 'map' | 'leaderboard';

const TerritoryGameScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = useStyles();
  const [activeTab, setActiveTab] = useState<Tab>('map');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isChangingColor, setIsChangingColor] = useState(false);

  const {
    gameState,
    cells,
    leaderboard,
    location,
    locationError,
    userCell,
    isLoading,
    isClaiming,
    cooldownSeconds,
    locationRequested,
    viewerMode,
    register,
    claimCell,
    changeColor,
    requestLocation,
    enterViewerMode,
    onMapBoundsChanged,
  } = useTerritoryGame();

  const handleChangeColor = async (color: string) => {
    setIsChangingColor(true);
    try {
      await changeColor(color);
      setShowColorPicker(false);
    } catch {
      // error logged in hook
    } finally {
      setIsChangingColor(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading FrenZones...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show registration if user hasn't joined yet
  if (gameState && !gameState.isRegistered) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <TerritoryRegistration onRegister={register} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🗺️ FrenZones</Text>
        <TouchableOpacity onPress={() => setShowColorPicker(true)} style={styles.backButton}>
          <View style={[styles.colorIndicator, { backgroundColor: gameState?.playerColor || theme.colors.primary }]} />
        </TouchableOpacity>
      </View>

      {/* Color Picker Modal */}
      <Modal visible={showColorPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowColorPicker(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Change Your Color</Text>
            <View style={styles.colorGrid}>
              {TERRITORY_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  onPress={() => handleChangeColor(color)}
                  disabled={isChangingColor}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color },
                    gameState?.playerColor === color && styles.colorSwatchSelected,
                    gameState?.playerColor === color && { borderColor: theme.colors.textPrimary },
                  ]}
                >
                  {gameState?.playerColor === color && (
                    <Ionicons name="checkmark" size={20} color="#FFF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            {isChangingColor && (
              <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginTop: 12 }} />
            )}
            <Text style={styles.modalHint}>
                Update the color for all your claimed zones.
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'map' && styles.tabActive]}
          onPress={() => setActiveTab('map')}
        >
          <Ionicons
            name="map"
            size={18}
            color={activeTab === 'map' ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'map' && styles.tabTextActive]}>
            Map
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'leaderboard' && styles.tabActive]}
          onPress={() => setActiveTab('leaderboard')}
        >
          <Ionicons
            name="trophy"
            size={18}
            color={activeTab === 'leaderboard' ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.tabTextActive]}>
            Leaderboard
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'map' ? (
        <TerritoryMap
          cells={cells}
          userCell={userCell}
          playerColor={gameState?.playerColor ?? null}
          cooldownSeconds={cooldownSeconds}
          isClaiming={isClaiming}
          locationError={locationError}
          locationRequested={locationRequested}
          location={location}
          viewerMode={viewerMode}
          onClaimCell={claimCell}
          onBoundsChanged={onMapBoundsChanged}
          onRequestLocation={requestLocation}
          onEnterViewerMode={enterViewerMode}
        />
      ) : (
        <ScrollView style={styles.leaderboardScroll}>
          <TerritoryLeaderboard leaderboard={leaderboard} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const useStyles = makeStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background === 'transparent' ? theme.colors.backgroundAlt : theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: theme.colors.textMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  headerRight: {
    width: 32,
  },
  colorIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderWidth: 3,
    transform: [{ scale: 1.1 }],
  },
  modalHint: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
    backgroundColor: theme.colors.card,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  tabTextActive: {
    color: theme.colors.primary,
  },
  leaderboardScroll: {
    flex: 1,
  },
}));

export default TerritoryGameScreen;
