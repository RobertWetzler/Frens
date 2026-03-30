import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { makeStyles } from '../../theme/makeStyles';
import { TerritoryPlayer } from 'services/territoryGame';
import { Ionicons } from '@expo/vector-icons';

interface TerritoryLeaderboardProps {
  players: TerritoryPlayer[];
}

const TerritoryLeaderboard: React.FC<TerritoryLeaderboardProps> = ({ players }) => {
  const { theme } = useTheme();
  const styles = useStyles();

  if (players.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="trophy-outline" size={40} color={theme.colors.textMuted} />
        <Text style={styles.emptyText}>No territory claimed yet</Text>
        <Text style={styles.emptySubtext}>Be the first to claim a cell!</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🏆 Leaderboard</Text>
      <FlatList
        data={players}
        scrollEnabled={false}
        keyExtractor={(item) => item.userId}
        renderItem={({ item, index }) => {
          const isTop3 = index < 3;
          const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;
          return (
            <View style={[styles.row, isTop3 && styles.rowTop3]}>
              <View style={styles.rankContainer}>
                {rankEmoji ? (
                  <Text style={styles.rankEmoji}>{rankEmoji}</Text>
                ) : (
                  <Text style={styles.rankNumber}>{index + 1}</Text>
                )}
              </View>
              <View style={[styles.colorDot, { backgroundColor: item.color }]} />
              <Text style={[styles.playerName, isTop3 && styles.playerNameBold]} numberOfLines={1}>
                {item.displayName}
              </Text>
              <View style={styles.scoreContainer}>
                <Text style={[styles.score, isTop3 && { color: item.color }]}>
                  {item.cellsClaimed}
                </Text>
                <Text style={styles.scoreLabel}>points</Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
};

const useStyles = makeStyles((theme) => ({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 12,
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
