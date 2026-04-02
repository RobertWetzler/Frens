import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { makeStyles } from '../../theme/makeStyles';
import { CityLeaderboard, TerritoryPlayer, NeighborhoodSection } from 'services/territoryGame';
import { Ionicons } from '@expo/vector-icons';

interface TerritoryLeaderboardProps {
  leaderboard: CityLeaderboard;
  onCityPress?: (city: string) => void;
  onPlayerPress?: (userId: string, city: string) => void;
}

const PlayerRow: React.FC<{ player: TerritoryPlayer; index: number; onPress?: () => void }> = ({ player, index, onPress }) => {
  const styles = useStyles();
  const isTop3 = index < 3;
  const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;
  return (
    <TouchableOpacity
      style={[styles.row, isTop3 && styles.rowTop3]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={styles.rankContainer}>
        {rankEmoji ? (
          <Text style={styles.rankEmoji}>{rankEmoji}</Text>
        ) : (
          <Text style={styles.rankNumber}>{index + 1}</Text>
        )}
      </View>
      <View style={[styles.colorDot, { backgroundColor: player.color }]} />
      <Text style={[styles.playerName, isTop3 && styles.playerNameBold]} numberOfLines={1}>
        {player.displayName}
      </Text>
      <View style={styles.scoreContainer}>
        <Text style={[styles.score, isTop3 && { color: player.color }]}>
          {player.cellsClaimed}
        </Text>
        <Text style={styles.scoreLabel}>points</Text>
      </View>
    </TouchableOpacity>
  );
};

const NeighborhoodDropdown: React.FC<{ neighborhoods: NeighborhoodSection[] }> = ({ neighborhoods }) => {
  const [expanded, setExpanded] = useState(false);
  const { theme } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.neighborhoodContainer}>
      <TouchableOpacity
        style={styles.neighborhoodToggle}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Ionicons name="map-outline" size={14} color={theme.colors.textMuted} />
        <Text style={styles.neighborhoodToggleText}>
          Neighborhoods ({neighborhoods.length})
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={theme.colors.textMuted}
        />
      </TouchableOpacity>
      {expanded && neighborhoods.map((nb) => (
        <View key={nb.neighborhood} style={styles.neighborhoodSection}>
          <View style={styles.neighborhoodHeader}>
            <Text style={styles.neighborhoodName}>{nb.neighborhood}</Text>
            {nb.userHasClaims && (
              <View style={styles.yourNeighborhoodBadge}>
                <Text style={styles.yourNeighborhoodText}>You</Text>
              </View>
            )}
          </View>
          {nb.players.map((player, index) => (
            <PlayerRow key={player.userId} player={player} index={index} />
          ))}
        </View>
      ))}
    </View>
  );
};

const TerritoryLeaderboard: React.FC<TerritoryLeaderboardProps> = ({ leaderboard, onCityPress, onPlayerPress }) => {
  const { theme } = useTheme();
  const styles = useStyles();

  if (leaderboard.cities.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="trophy-outline" size={40} color={theme.colors.textMuted} />
        <Text style={styles.emptyText}>No zones frenned yet</Text>
        <Text style={styles.emptySubtext}>Be the first to fren a zone!</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>🏆 Leaderboard</Text>
      {leaderboard.cities.map((section) => (
        <View key={section.city} style={styles.citySection}>
          <TouchableOpacity
            style={styles.cityHeader}
            onPress={() => onCityPress?.(section.city)}
            activeOpacity={onCityPress ? 0.7 : 1}
          >
            <Ionicons name="location" size={16} color={theme.colors.primary} />
            <Text style={styles.cityName}>{section.city}</Text>
            {section.userHasClaims && (
              <View style={styles.yourCityBadge}>
                <Text style={styles.yourCityText}>Your city</Text>
              </View>
            )}
            {onCityPress && (
              <Ionicons name="navigate-outline" size={14} color={theme.colors.textMuted} />
            )}
          </TouchableOpacity>
          {section.players.map((player, index) => (
            <PlayerRow
              key={player.userId}
              player={player}
              index={index}
              onPress={onPlayerPress ? () => onPlayerPress(player.userId, section.city) : undefined}
            />
          ))}
          {section.neighborhoods && section.neighborhoods.length > 0 && (
            <NeighborhoodDropdown neighborhoods={section.neighborhoods} />
          )}
        </View>
      ))}
    </View>
  );
};

const useStyles = makeStyles((theme) => ({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  citySection: {
    marginBottom: 20,
  },
  cityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.separator,
  },
  cityName: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    flex: 1,
  },
  yourCityBadge: {
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  yourCityText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    marginBottom: 6,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  rowTop3: {
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  rankContainer: {
    width: 32,
    alignItems: 'center',
  },
  rankEmoji: {
    fontSize: 20,
  },
  rankNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 10,
  },
  playerName: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  playerNameBold: {
    fontWeight: '600',
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  score: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  scoreLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  neighborhoodContainer: {
    marginTop: 4,
    marginBottom: 4,
  },
  neighborhoodToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  neighborhoodToggleText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  neighborhoodSection: {
    marginLeft: 12,
    marginBottom: 12,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.separator,
    paddingLeft: 12,
  },
  neighborhoodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  neighborhoodName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    flex: 1,
  },
  yourNeighborhoodBadge: {
    backgroundColor: theme.colors.primary + '15',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  yourNeighborhoodText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.primary,
  },
}));

export default TerritoryLeaderboard;
