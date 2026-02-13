import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CirclePublicDto, UserDto, InterestPublicDto, InterestSuggestionDto } from 'services/generated/generatedClient';
import Avatar from './Avatar';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';

// A unified item type so all three audiences can share one selection model
export type AudienceItemType = 'circle' | 'friend' | 'interest';

export interface AudienceItem {
  id: string;
  type: AudienceItemType;
  label: string;       // display name
  subtitle?: string;   // e.g. "Shared circle" / "12 friends"
  icon?: string;       // Ionicons name
  isShared?: boolean;
  isOwner?: boolean;
  // For friends with avatars
  userId?: string;
  profilePictureUrl?: string;
}

interface AudiencePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  circles: CirclePublicDto[];
  friends: UserDto[];
  followedInterests: InterestPublicDto[];
  suggestedInterests: InterestSuggestionDto[];
  selectedCircleIds: string[];
  selectedUserIds: string[];
  selectedInterestNames: string[];
  onToggleCircle: (id: string) => void;
  onToggleFriend: (id: string) => void;
  onToggleInterest: (name: string, displayName: string) => void;
  onCreateCircle: () => void;
  onCreateInterest: (name: string) => Promise<void>;
}

type TabKey = 'circles' | 'friends' | 'interests';

const AudiencePickerSheet: React.FC<AudiencePickerSheetProps> = ({
  visible,
  onClose,
  circles,
  friends,
  followedInterests,
  suggestedInterests,
  selectedCircleIds,
  selectedUserIds,
  selectedInterestNames,
  onToggleCircle,
  onToggleFriend,
  onToggleInterest,
  onCreateCircle,
  onCreateInterest,
}) => {
  const { theme } = useTheme();
  const styles = useStyles();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('circles');
  const [showCreateInterest, setShowCreateInterest] = useState(false);
  const [newInterestName, setNewInterestName] = useState('');
  const [isCreatingInterest, setIsCreatingInterest] = useState(false);
  const [expandedCircleIds, setExpandedCircleIds] = useState<Set<string>>(new Set());
  const createInterestInputRef = useRef<TextInput>(null);
  const searchInputRef = useRef<TextInput>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Reset search when opening
  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      Animated.spring(slideAnim, {
        toValue: 1,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }).start();
      // Focus search after a slight delay for the modal to render
      setTimeout(() => searchInputRef.current?.focus(), 300);
    } else {
      slideAnim.setValue(0);
    }
  }, [visible, slideAnim]);

  const query = searchQuery.trim().toLowerCase();

  // Build flat items for the active tab, filtered by search
  const filteredCircles = useMemo(() => {
    if (!query) return circles;
    return circles.filter(c => c.name?.toLowerCase().includes(query));
  }, [circles, query]);

  const filteredFriends = useMemo(() => {
    if (!query) return friends;
    return friends.filter(f => f.name?.toLowerCase().includes(query));
  }, [friends, query]);

  // Merge followed + suggested interests, deduplicated, filtered
  const allInterests = useMemo(() => {
    const map = new Map<string, { id: string; name: string; displayName: string; friendsCount?: number; isFollowed: boolean }>();
    for (const i of followedInterests) {
      map.set(i.name!, { id: i.id!, name: i.name!, displayName: i.displayName!, isFollowed: true });
    }
    for (const i of suggestedInterests) {
      if (!map.has(i.name!)) {
        map.set(i.name!, { id: i.id!, name: i.name!, displayName: i.displayName!, friendsCount: i.friendsUsingCount, isFollowed: false });
      }
    }
    return Array.from(map.values());
  }, [followedInterests, suggestedInterests]);

  const filteredInterests = useMemo(() => {
    if (!query) return allInterests;
    return allInterests.filter(i => 
      i.displayName.toLowerCase().includes(query) || i.name.toLowerCase().includes(query)
    );
  }, [allInterests, query]);

  // Cross-tab search: if searching, show match counts on other tabs
  const crossTabCounts = useMemo(() => {
    if (!query) return null;
    return {
      circles: circles.filter(c => c.name?.toLowerCase().includes(query)).length,
      friends: friends.filter(f => f.name?.toLowerCase().includes(query)).length,
      interests: allInterests.filter(i => i.displayName.toLowerCase().includes(query) || i.name.toLowerCase().includes(query)).length,
    };
  }, [query, circles, friends, allInterests]);

  const totalSelected = selectedCircleIds.length + selectedUserIds.length + selectedInterestNames.length;

  const tabs: { key: TabKey; label: string; icon: string; count: number }[] = [
    { key: 'circles', label: 'Circles', icon: 'people-outline', count: selectedCircleIds.length },
    { key: 'friends', label: 'Friends', icon: 'person-outline', count: selectedUserIds.length },
    { key: 'interests', label: 'Interests', icon: 'sparkles-outline', count: selectedInterestNames.length },
  ];

  const toggleCircleExpanded = (circleId: string) => {
    setExpandedCircleIds(prev => {
      const next = new Set(prev);
      if (next.has(circleId)) next.delete(circleId);
      else next.add(circleId);
      return next;
    });
  };

  const renderCircleItem = ({ item }: { item: CirclePublicDto }) => {
    const isSelected = selectedCircleIds.includes(item.id!);
    const isExpanded = expandedCircleIds.has(item.id!);
    const memberCount = item.mentionableUsers?.length ?? 0;
    return (
      <View style={styles.circleItemWrapper}>
        <View style={[styles.listItem, { marginVertical: 0 }, isSelected && styles.listItemSelected]}>
          <TouchableOpacity
            style={styles.circleMainRow}
            onPress={() => onToggleCircle(item.id!)}
            activeOpacity={0.7}
          >
            <View style={[styles.itemIcon, isSelected && styles.itemIconSelected]}>
              <Ionicons
                name={item.isShared ? 'people' : 'person'}
                size={18}
                color={isSelected ? theme.colors.primaryContrast : theme.colors.primary}
              />
            </View>
            <View style={styles.itemContent}>
              <Text style={[styles.itemLabel, isSelected && styles.itemLabelSelected]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.itemSubtitle, isSelected && styles.itemSubtitleSelected]} numberOfLines={1}>
                {memberCount} {memberCount === 1 ? 'member' : 'members'}
                {item.isShared ? ' · Shared' : ''}
                {item.isSubscribable ? ' · Subscribable' : ''}
              </Text>
            </View>
            <Ionicons
              name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={isSelected ? theme.colors.primaryContrast : theme.colors.separator}
            />
          </TouchableOpacity>
          {memberCount > 0 && (
            <TouchableOpacity
              style={[styles.expandToggle, isSelected && styles.expandToggleSelected]}
              onPress={() => toggleCircleExpanded(item.id!)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={isSelected ? theme.colors.primaryContrast : theme.colors.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>
        {isExpanded && memberCount > 0 && (
          <View style={styles.memberList}>
            {item.mentionableUsers!.map(user => (
              <View key={user.id} style={styles.memberRow}>
                <Avatar
                  name={user.name || '?'}
                  userId={user.id || ''}
                  imageUrl={user.profilePictureUrl || undefined}
                  simple
                  size={24}
                />
                <Text style={styles.memberName} numberOfLines={1}>{user.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderFriendItem = ({ item }: { item: UserDto }) => {
    const isSelected = selectedUserIds.includes(item.id!);
    return (
      <TouchableOpacity
        style={[styles.listItem, isSelected && styles.listItemSelected]}
        onPress={() => onToggleFriend(item.id!)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          <Avatar
            name={item.name || '?'}
            userId={item.id || ''}
            imageUrl={item.profilePictureUrl || undefined}
            simple
            size={36}
          />
        </View>
        <View style={styles.itemContent}>
          <Text style={[styles.itemLabel, isSelected && styles.itemLabelSelected]} numberOfLines={1}>
            {item.name}
          </Text>
        </View>
        <Ionicons
          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={isSelected ? theme.colors.primaryContrast : theme.colors.separator}
        />
      </TouchableOpacity>
    );
  };

  const renderInterestItem = ({ item }: { item: typeof allInterests[0] }) => {
    const isSelected = selectedInterestNames.includes(item.name);
    return (
      <TouchableOpacity
        style={[styles.listItem, isSelected && styles.listItemSelected]}
        onPress={() => onToggleInterest(item.name, item.displayName)}
        activeOpacity={0.7}
      >
        <View style={[styles.itemIcon, isSelected && styles.itemIconSelected, styles.hashtagIcon]}>
          <Text style={[styles.hashtagText, isSelected && styles.hashtagTextSelected]}>#</Text>
        </View>
        <View style={styles.itemContent}>
          <Text style={[styles.itemLabel, isSelected && styles.itemLabelSelected]} numberOfLines={1}>
            {item.displayName}
          </Text>
          {item.friendsCount != null && (
            <Text style={[styles.itemSubtitle, isSelected && styles.itemSubtitleSelected]} numberOfLines={1}>
              {item.friendsCount} {item.friendsCount === 1 ? 'friend posts here' : 'friends post here'}
            </Text>
          )}
          {item.isFollowed && !item.friendsCount && (
            <Text style={[styles.itemSubtitle, isSelected && styles.itemSubtitleSelected]} numberOfLines={1}>
              Following
            </Text>
          )}
        </View>
        <Ionicons
          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={isSelected ? theme.colors.primaryContrast : theme.colors.separator}
        />
      </TouchableOpacity>
    );
  };

  const handleCreateInterest = async () => {
    const cleaned = newInterestName.trim().replace(/^#/, '');
    if (!cleaned) return;
    setIsCreatingInterest(true);
    try {
      await onCreateInterest(cleaned);
      setNewInterestName('');
      setShowCreateInterest(false);
    } catch (e) {
      console.error('Failed to create interest:', e);
    } finally {
      setIsCreatingInterest(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.sheetContainer}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetFlex}
        >
          {/* Header */}
          <View style={styles.sheetHeader}>
            <TouchableOpacity onPress={onClose} style={styles.sheetCloseButton}>
              <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.sheetTitle}>Choose Audience</Text>
            <TouchableOpacity onPress={onClose} style={styles.sheetDoneButton}>
              <Text style={styles.sheetDoneText}>
                Done{totalSelected > 0 ? ` (${totalSelected})` : ''}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color={theme.colors.textMuted} style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search circles, friends, #interests..."
              placeholderTextColor={theme.colors.inputPlaceholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClear}>
                <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Tab bar */}
          <View style={styles.tabBar}>
            {tabs.map(tab => {
              const isActive = activeTab === tab.key;
              const matchCount = crossTabCounts?.[tab.key];
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, isActive && styles.tabActive]}
                  onPress={() => setActiveTab(tab.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={tab.icon as any}
                    size={16}
                    color={isActive ? theme.colors.primary : theme.colors.textMuted}
                  />
                  <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                    {tab.label}
                    {tab.count > 0 && ` (${tab.count})`}
                  </Text>
                  {/* Show search match count badge on non-active tabs */}
                  {query && !isActive && matchCount != null && matchCount > 0 && (
                    <View style={styles.matchBadge}>
                      <Text style={styles.matchBadgeText}>{matchCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Content */}
          <View style={styles.sheetContent}>
            {activeTab === 'circles' && (
              <FlatList
                data={filteredCircles}
                keyExtractor={(item) => item.id!}
                renderItem={renderCircleItem}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    {query ? 'No circles match your search' : 'No circles yet'}
                  </Text>
                }
                ListFooterComponent={
                  <TouchableOpacity
                    style={styles.createButton}
                    onPress={onCreateCircle}
                    activeOpacity={0.7}
                  >
                    <View style={styles.createButtonIcon}>
                      <Ionicons name="add" size={18} color={theme.colors.primary} />
                    </View>
                    <Text style={styles.createButtonText}>Create New Circle</Text>
                  </TouchableOpacity>
                }
              />
            )}

            {activeTab === 'friends' && (
              <FlatList
                data={filteredFriends}
                keyExtractor={(item) => item.id!}
                renderItem={renderFriendItem}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    {query ? 'No friends match your search' : 'No friends yet'}
                  </Text>
                }
              />
            )}

            {activeTab === 'interests' && (
              <FlatList
                data={filteredInterests}
                keyExtractor={(item) => item.id}
                renderItem={renderInterestItem}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    {query ? 'No interests match your search' : 'No interests yet'}
                  </Text>
                }
                ListFooterComponent={
                  <TouchableOpacity
                    style={styles.createButton}
                    onPress={() => {
                      setNewInterestName('');
                      setShowCreateInterest(true);
                      setTimeout(() => createInterestInputRef.current?.focus(), 100);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.createButtonIcon}>
                      <Ionicons name="add" size={18} color={theme.colors.primary} />
                    </View>
                    <Text style={styles.createButtonText}>Create New Interest</Text>
                  </TouchableOpacity>
                }
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Create Interest Dialog */}
      {showCreateInterest && (
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogBox}>
            <Text style={styles.dialogTitle}>Create New Interest</Text>
            <Text style={styles.dialogSubtitle}>Choose a name for your interest tag</Text>
            <View style={styles.dialogInputRow}>
              <Text style={styles.dialogHash}>#</Text>
              <TextInput
                ref={createInterestInputRef}
                style={styles.dialogInput}
                placeholder="e.g. hiking, cooking, music"
                placeholderTextColor={theme.colors.inputPlaceholder}
                value={newInterestName}
                onChangeText={setNewInterestName}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={handleCreateInterest}
                returnKeyType="done"
              />
            </View>
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={styles.dialogCancelButton}
                onPress={() => setShowCreateInterest(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.dialogCreateButton,
                  (!newInterestName.trim().replace(/^#/, '') || isCreatingInterest) && styles.dialogCreateButtonDisabled,
                ]}
                onPress={handleCreateInterest}
                disabled={!newInterestName.trim().replace(/^#/, '') || isCreatingInterest}
                activeOpacity={0.7}
              >
                {isCreatingInterest ? (
                  <ActivityIndicator size="small" color={theme.colors.primaryContrast} />
                ) : (
                  <Text style={styles.dialogCreateText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </Modal>
  );
};

const useStyles = makeStyles((theme) => ({
  // Sheet container
  sheetContainer: {
    flex: 1,
    backgroundColor: theme.colors.backgroundAlt,
  },
  sheetFlex: {
    flex: 1,
  },

  // Header
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.separator,
    backgroundColor: theme.colors.card,
  },
  sheetCloseButton: {
    padding: 4,
    minWidth: 40,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  sheetDoneButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.primary,
    borderRadius: 18,
    minWidth: 40,
    alignItems: 'center',
  },
  sheetDoneText: {
    color: theme.colors.primaryContrast,
    fontWeight: '600',
    fontSize: 14,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    marginHorizontal: 12,
    marginVertical: 10,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.textPrimary,
    paddingVertical: 10,
  },
  searchClear: {
    padding: 4,
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 6,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    gap: 4,
  },
  tabActive: {
    backgroundColor: theme.colors.primary + '18',
    borderWidth: 1,
    borderColor: theme.colors.primary + '40',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.textMuted,
  },
  tabLabelActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  matchBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginLeft: 2,
  },
  matchBadgeText: {
    color: theme.colors.primaryContrast,
    fontSize: 10,
    fontWeight: '700',
  },

  // List items
  sheetContent: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  circleItemWrapper: {
    marginVertical: 3,
  },
  circleMainRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandToggle: {
    paddingLeft: 8,
    paddingRight: 4,
    paddingVertical: 4,
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.separator + '60',
    marginLeft: 8,
  },
  expandToggleSelected: {
    borderLeftColor: 'rgba(255,255,255,0.25)',
  },
  memberList: {
    backgroundColor: theme.colors.card,
    marginTop: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    gap: 4,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  memberName: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginVertical: 3,
    backgroundColor: theme.colors.card,
  },
  listItemSelected: {
    backgroundColor: theme.colors.primary,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconSelected: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  hashtagIcon: {
    // same size, slightly different styling for the # character
  },
  hashtagText: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  hashtagTextSelected: {
    color: theme.colors.primaryContrast,
  },
  avatarContainer: {
    marginRight: 0,
  },
  itemContent: {
    flex: 1,
    marginLeft: 10,
  },
  itemLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  itemLabelSelected: {
    color: theme.colors.primaryContrast,
  },
  itemSubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  itemSubtitleSelected: {
    color: theme.colors.primaryContrast,
    opacity: 0.8,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: 14,
    paddingVertical: 32,
  },

  // Create / New interest
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginVertical: 3,
    borderWidth: 1,
    borderColor: theme.colors.primary + '40',
    borderStyle: 'dashed',
  },
  createButtonIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.primary,
    marginLeft: 10,
  },
  newInterestItem: {
    borderWidth: 1,
    borderColor: theme.colors.primary + '40',
    borderStyle: 'dashed',
    backgroundColor: theme.colors.primary + '08',
  },
  newInterestIcon: {
    backgroundColor: theme.colors.primary + '20',
  },

  // Create Interest Dialog
  dialogOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 100,
  },
  dialogBox: {
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  dialogSubtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: 18,
  },
  dialogInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  dialogHash: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.primary,
    marginRight: 4,
  },
  dialogInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.textPrimary,
    paddingVertical: 12,
  },
  dialogButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  dialogCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundAlt,
  },
  dialogCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  dialogCreateButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
  },
  dialogCreateButtonDisabled: {
    opacity: 0.5,
  },
  dialogCreateText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.primaryContrast,
  },
}));

export default AudiencePickerSheet;
