import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  Pressable,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CirclePublicDto } from '../services/generated/generatedClient';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';

interface CircleFilterProps {
  circles: CirclePublicDto[];
  selectedCircleIds: string[];
  onCircleToggle: (circleId: string) => void;
  onClearAll: () => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  animationDelay?: number;
  shouldAnimate?: boolean;
}

const CircleFilter: React.FC<CircleFilterProps> = ({
  circles,
  selectedCircleIds,
  onCircleToggle,
  onClearAll,
  isExpanded,
  onToggleExpanded,
  animationDelay = 0,
  shouldAnimate = false,
}) => {
  const animatedHeight = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(shouldAnimate ? 100 : 0)).current;
  const opacity = useRef(new Animated.Value(shouldAnimate ? 0 : 1)).current;
  const scale = useRef(new Animated.Value(shouldAnimate ? 0.8 : 1)).current;

  useEffect(() => {
    if (shouldAnimate) {
      const animateIn = () => {
        console.log(`Starting animation for filter`);
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            tension: 50,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            tension: 100,
            friction: 7,
            useNativeDriver: true,
          }),
        ]).start(() => {
          console.log(`Animation completed for filter`);
        });
      };

      // Apply staggered delay
      const timer = setTimeout(animateIn, animationDelay);
      return () => clearTimeout(timer);
    }
  }, [shouldAnimate, animationDelay, opacity, translateY, scale]);

  React.useEffect(() => {
    Animated.timing(animatedHeight, {
      toValue: isExpanded ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isExpanded]);

  const maxHeight = animatedHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 320], // Increased max height to accommodate more circles
  });

  const getDisplayText = () => {
    if (selectedCircleIds.length === 0) {
      return 'All Circles';
    } else if (selectedCircleIds.length === 1) {
      const circle = circles.find(c => c.id === selectedCircleIds[0]);
      return circle?.name || 'Unknown Circle';
    } else {
      return `${selectedCircleIds.length} Circles`;
    }
  };

  const { theme } = useTheme();
  const styles = useStyles();

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          transform: [
            { translateY },
            { scale }
          ],
          opacity,
        }
      ]}
    >
      {/* Filter Button */}
      <TouchableOpacity
        style={styles.filterButton}
        onPress={onToggleExpanded}
        activeOpacity={0.8}
      >
        <View style={styles.filterButtonContent}>
          <Ionicons name="funnel-outline" size={18} color={theme.colors.accent} style={styles.filterIcon} />
          <Text style={styles.filterText}>{getDisplayText()}</Text>
          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.accent} />
        </View>
        {selectedCircleIds.length > 0 && (
          <View style={styles.filterBadge}>
            <Text style={styles.filterBadgeText}>{selectedCircleIds.length}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Modal Dropdown */}
      <Modal
        visible={isExpanded}
        transparent={true}
        animationType="fade"
        onRequestClose={onToggleExpanded}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={onToggleExpanded}
        >
          <View style={styles.modalDropdown}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.dropdownContent}>
                {/* Clear All Button */}
                {selectedCircleIds.length > 0 && (
                  <TouchableOpacity
                    style={styles.clearAllButton}
                    onPress={onClearAll}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-circle" size={16} color={theme.colors.textMuted} />
                    <Text style={styles.clearAllText}>Clear All</Text>
                  </TouchableOpacity>
                )}
                
                {/* Circle List */}
                <ScrollView
                  style={styles.circleList}
                  showsVerticalScrollIndicator={true}
                  scrollEnabled={true}
                  bounces={false}
                  overScrollMode="never"
                >
                  {circles.map((item) => {
                    const isSelected = selectedCircleIds.includes(item.id || '');
                    
                    return (
                      <TouchableOpacity
                        key={item.id || ''}
                        style={[styles.circleItem, isSelected && styles.selectedCircleItem]}
                        onPress={() => onCircleToggle(item.id || '')}
                        activeOpacity={0.7}
                      >
                        <View style={styles.circleItemContent}>
                          <Text style={[styles.circleText, isSelected && styles.selectedCircleText]}>
                            {item.name}
                          </Text>
                          <View style={styles.circleInfo}>
                            {item.isOwner 
                            //  && (<Ionicons name="crown" size={14} color={isSelected ? '#fff' : '#666'} />)
                            }
                            {isSelected && (
                              <Ionicons name="checkmark" size={16} color={theme.colors.primaryContrast} style={styles.checkmark} />
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </Animated.View>
  );
};

const useStyles = makeStyles(theme => ({
  container: {
    zIndex: 1000,
    elevation: 1000,
  },
  filterButton: {
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
    alignSelf: 'flex-start',
  },
  filterButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterIcon: {
    marginRight: 8,
  },
  filterText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  filterBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: theme.colors.accent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: theme.colors.primaryContrast,
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-start',
    paddingTop: 120,
  },
  modalDropdown: {
    marginHorizontal: 16,
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 1000,
    maxHeight: 400,
  },
  dropdownContent: {
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 4,
    backgroundColor: theme.colors.backgroundAlt,
    borderRadius: 8,
  },
  clearAllText: {
    marginLeft: 8,
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  circleList: {
    maxHeight: 300,
  },
  circleItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginVertical: 2,
    backgroundColor: 'transparent',
  },
  selectedCircleItem: {
    backgroundColor: theme.colors.accent,
  },
  circleItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circleText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  selectedCircleText: {
    color: theme.colors.primaryContrast,
  },
  circleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkmark: {
    marginLeft: 4,
  },
}));

export default CircleFilter;
