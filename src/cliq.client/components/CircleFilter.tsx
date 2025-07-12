import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  FlatList,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CirclePublicDto } from '../services/generated/generatedClient';

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
    outputRange: [0, 230], // Increased max height for the dropdown
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

  const renderCircleItem = ({ item }: { item: CirclePublicDto }) => {
    const isSelected = selectedCircleIds.includes(item.id || '');
    
    return (
      <TouchableOpacity
        style={[styles.circleItem, isSelected && styles.selectedCircleItem]}
        onPress={() => onCircleToggle(item.id || '')}
        activeOpacity={0.7}
      >
        <View style={styles.circleItemContent}>
          <Text style={[styles.circleText, isSelected && styles.selectedCircleText]}>
            {item.name}
          </Text>
          <View style={styles.circleInfo}>
            {item.isOwner && (
              <Ionicons name="crown" size={14} color={isSelected ? '#fff' : '#666'} />
            )}
            {isSelected && (
              <Ionicons name="checkmark" size={16} color="#fff" style={styles.checkmark} />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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
          <Ionicons 
            name="funnel-outline" 
            size={18} 
            color="#6699FF" 
            style={styles.filterIcon}
          />
          <Text style={styles.filterText}>{getDisplayText()}</Text>
          <Ionicons 
            name={isExpanded ? "chevron-up" : "chevron-down"} 
            size={16} 
            color="#6699FF" 
          />
        </View>
        {selectedCircleIds.length > 0 && (
          <View style={styles.filterBadge}>
            <Text style={styles.filterBadgeText}>{selectedCircleIds.length}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Dropdown */}
      <Animated.View style={[styles.dropdown, { maxHeight }]}>
        <View style={styles.dropdownContent}>
          {/* Clear All Button */}
          {selectedCircleIds.length > 0 && (
            <TouchableOpacity
              style={styles.clearAllButton}
              onPress={onClearAll}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle" size={16} color="#666" />
              <Text style={styles.clearAllText}>Clear All</Text>
            </TouchableOpacity>
          )}
          
          {/* Circle List */}
          <FlatList
            data={circles}
            renderItem={renderCircleItem}
            keyExtractor={(item) => item.id || ''}
            style={styles.circleList}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          />
        </View>
      </Animated.View>

      {/* Backdrop for closing dropdown */}
      {isExpanded && (
        <Pressable
          style={styles.backdrop}
          onPress={onToggleExpanded}
        />
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    zIndex: 1000,
    elevation: 1000,
  },
  filterButton: {
    backgroundColor: 'white',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
    alignSelf: 'flex-start', // Make it only as wide as needed
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
    color: '#333',
  },
  filterBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#6699FF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dropdown: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
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
    backgroundColor: '#F7F9FA',
    borderRadius: 8,
  },
  clearAllText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  circleList: {
    maxHeight: 180,
  },
  circleItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginVertical: 2,
    backgroundColor: 'transparent',
  },
  selectedCircleItem: {
    backgroundColor: '#6699FF',
  },
  circleItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circleText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  selectedCircleText: {
    color: 'white',
  },
  circleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkmark: {
    marginLeft: 4,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
});

export default CircleFilter;
