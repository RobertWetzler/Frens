import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { makeStyles } from '../../theme/makeStyles';
import { CityLeaderboard } from 'services/territoryGame';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../Avatar';

interface TerritoryLeaderboardProps {
  leaderboard: CityLeaderboard;
}

const TerritoryLeaderboard: React.FC<TerritoryLeaderboardProps> = ({ leaderboard }) => {
  const { theme } = useTheme();
  const styles = useStyles();

  if (leaderboard.cities.length === 0 && leaderboard.mostWanted.length === 0) {
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

      {leaderboard.mostWanted.length > 0 && (
        <View style={styles.citySection}>
          <View style={styles.cityHeader}>
            <Ionicons name="warning" size={16} color={theme.colors.danger} />
            <Text style={styles.cityName}>Most Wanted</Text>
          </View>
          {leaderboard.mostWanted.map((entry, index) => (
            <View key={entry.userId} style={styles.row}>
              <View style={styles.rankContainer}>
                <Text style={styles.rankNumber}>{index + 1}</Text>
              </View>
              <Avatar
                name={entry.displayName}
                userId={entry.userId}
                imageUrl={entry.profilePictureUrl || undefined}
                simple
                size={28}
              />
              <Text style={styles.playerName} numberOfLines={1}>
                {entry.displayName}
              </Text>
              <View style={styles.scoreContainer}>
                <Text style={[styles.score, { color: theme.colors.danger }]}>{entry.spoofAttempts}</Text>
                <Text style={styles.scoreLabel}>spoof attempts</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {leaderboard.cities.map((section) => (
        <View key={section.city} style={styles.citySection}>
          <View style={styles.cityHeader}>
            <Ionicons name="location" size={16} color={theme.colors.primary} />
            <Text style={styles.cityName}>{section.city}</Text>
            {section.userHasClaims && (
              <View style={styles.yourCityBadge}>
                <Text style={styles.yourCityText}>Your city</Text>
              </View>
            )}
          </View>
          {section.players.map((player, index) => {
            const isTop3 = index < 3;
            const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;
            return (
              <View key={player.userId} style={[styles.row, isTop3 && styles.rowTop3]}>
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
              </View>
            );
          })}
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
}));

export default TerritoryLeaderboard;
