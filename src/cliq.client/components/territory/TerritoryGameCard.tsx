import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/ThemeContext';
import { makeStyles } from '../../theme/makeStyles';

interface TerritoryGameCardProps {
  onPress: () => void;
  shouldAnimate?: boolean;
  animationDelay?: number;
}

const TerritoryGameCard: React.FC<TerritoryGameCardProps> = ({
  onPress,
  shouldAnimate = false,
  animationDelay = 0,
}) => {
  const { theme } = useTheme();
  const styles = useStyles();
  const translateY = useRef(new Animated.Value(shouldAnimate ? 60 : 0)).current;
  const opacity = useRef(new Animated.Value(shouldAnimate ? 0 : 1)).current;
  const scale = useRef(new Animated.Value(shouldAnimate ? 0.9 : 1)).current;

  useEffect(() => {
    if (shouldAnimate) {
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.spring(translateY, {
            toValue: 0,
            tension: 50,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            tension: 50,
            friction: 8,
            useNativeDriver: true,
          }),
        ]).start();
      }, animationDelay);
      return () => clearTimeout(timer);
    }
  }, [shouldAnimate, animationDelay]);

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
        <LinearGradient
          colors={['#FF6B35', '#FF3864', '#B620E0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          {/* Decorative grid dots */}
          <View style={styles.gridDecoration}>
            {Array.from({ length: 25 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.gridDot,
                  { opacity: 0.15 + Math.random() * 0.25 },
                ]}
              />
            ))}
          </View>

          <View style={styles.content}>
            <View style={styles.textSection}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>🎮 APRIL FOOLS</Text>
              </View>
              <Text style={styles.title}>Territory Wars</Text>
              <Text style={styles.description}>
                Claim real-world territory by walking to it. Compete with friends for the biggest empire!
              </Text>
            </View>
            <View style={styles.iconSection}>
              <View style={styles.mapIconContainer}>
                <Text style={styles.mapEmoji}>🗺️</Text>
              </View>
              <View style={styles.playButton}>
                <Ionicons name="play" size={16} color="#FFF" />
                <Text style={styles.playText}>Play</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const useStyles = makeStyles((theme) => ({
  wrapper: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    overflow: 'hidden',
    shadowColor: '#FF3864',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  gridDecoration: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 100,
    height: 100,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 8,
    opacity: 0.6,
  },
  gridDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#FFF',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textSection: {
    flex: 1,
    marginRight: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 18,
  },
  iconSection: {
    alignItems: 'center',
    gap: 8,
  },
  mapIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapEmoji: {
    fontSize: 28,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  playText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
}));

export default TerritoryGameCard;
