import React, { useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';
import { useTerritoryGame } from 'hooks/useTerritoryGame';
import TerritoryRegistration from 'components/territory/TerritoryRegistration';
import TerritoryMap from 'components/territory/TerritoryMap';
import TerritoryLeaderboard from 'components/territory/TerritoryLeaderboard';

type Tab = 'map' | 'leaderboard';

const TerritoryGameScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = useStyles();
  const [activeTab, setActiveTab] = useState<Tab>('map');

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
    register,
    claimCell,
    onMapBoundsChanged,
  } = useTerritoryGame();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading Territory Wars...</Text>
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
        <Text style={styles.headerTitle}>🗺️ Territory Wars</Text>
        <View style={styles.headerRight} />
      </View>

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
          location={location}
          onClaimCell={claimCell}
          onBoundsChanged={onMapBoundsChanged}
        />
      ) : (
        <ScrollView style={styles.leaderboardScroll}>
          <TerritoryLeaderboard players={leaderboard} />
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
