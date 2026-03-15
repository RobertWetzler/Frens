import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCirclesWithMembers } from '../hooks/useCircle';
import { InterestDto } from 'services/generated/generatedClient';
import { ApiClient } from 'services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';
import Username from 'components/Username';
import Avatar from 'components/Avatar';
import DropdownMenu, { DropdownMenuItem } from '../components/DropdownMenu';
import ConfirmationModal from '../components/ConfirmationModal';

const CirclesScreen = ({ navigation }) => {
  const { 
    circles, 
    isLoading, 
    error, 
    deleteCircle, 
    convertCircleToInterest,
    loadCircles, 
    removeUsersFromCircle,
    addUsersToCircle,
    isRemovingUser: isRemovingUserHook,
    isAddingUser
  } = useCirclesWithMembers();
  const { user } = useAuth();
  const { theme } = useTheme();
  const styles = useStyles();
  
  // Add logging to track circles state changes
  React.useEffect(() => {
    console.log('CirclesScreen: circles state updated, count:', circles.length);
    console.log('CirclesScreen: circles:', circles.map(c => ({ id: c.id, name: c.name, memberCount: c.members?.length || 0 })));
  }, [circles]);
  const [expandedCircles, setExpandedCircles] = useState<Set<string>>(new Set());
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [circleToDelete, setCircleToDelete] = useState<{id: string, name: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [convertModalVisible, setConvertModalVisible] = useState(false);
  const [circleToConvert, setCircleToConvert] = useState<{id: string, name: string} | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [removeUserModalVisible, setRemoveUserModalVisible] = useState(false);
  const [userToRemove, setUserToRemove] = useState<{circleId: string, userId: string, userName: string, circleName: string} | null>(null);
  const [isRemovingUser, setIsRemovingUser] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [interests, setInterests] = useState<InterestDto[]>([]);
  const [unfollowModalVisible, setUnfollowModalVisible] = useState(false);
  const [itemToUnfollow, setItemToUnfollow] = useState<{type: 'circle' | 'interest', id: string, name: string} | null>(null);
  const [isUnfollowing, setIsUnfollowing] = useState(false);

  const loadInterests = useCallback(async () => {
    try {
      const result = await ApiClient.call(c => c.interest_GetMyInterests());
      setInterests(result);
    } catch (err) {
      console.log('Failed to load interests:', err);
    }
  }, []);

  const query = searchQuery.trim().toLowerCase();

  // Separate, filter, and sort circles
  const ownedCircles = useMemo(() => {
    const owned = circles.filter(c => c.isOwner);
    const filtered = query ? owned.filter(c => c.name?.toLowerCase().includes(query)) : owned;
    return filtered.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  }, [circles, query]);

  const sharedCircles = useMemo(() => {
    const shared = circles.filter(c => !c.isOwner);
    const filtered = query ? shared.filter(c => c.name?.toLowerCase().includes(query)) : shared;
    return filtered.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  }, [circles, query]);

  const filteredInterests = useMemo(() => {
    const filtered = query ? interests.filter(i => (i.displayName ?? i.name ?? '').toLowerCase().includes(query)) : interests;
    return filtered.sort((a, b) => (a.displayName ?? '').localeCompare(b.displayName ?? ''));
  }, [interests, query]);

  const handleUnfollow = (type: 'circle' | 'interest', id: string, name: string) => {
    setItemToUnfollow({ type, id, name });
    setUnfollowModalVisible(true);
  };

  const confirmUnfollow = async () => {
    if (!itemToUnfollow) return;
    setIsUnfollowing(true);
    try {
      if (itemToUnfollow.type === 'circle') {
        await ApiClient.call(c => c.circle_UnfollowCircle(itemToUnfollow.id));
        await loadCircles();
      } else {
        await ApiClient.call(c => c.interest_UnfollowInterest(itemToUnfollow.id));
        setInterests(prev => prev.filter(i => i.name !== itemToUnfollow.id));
      }
    } catch (err) {
      console.error('Failed to unfollow:', err);
    } finally {
      setIsUnfollowing(false);
      setUnfollowModalVisible(false);
      setItemToUnfollow(null);
    }
  };

  //Refresh circles when screen comes into focus
  // TODO - This could be optimized to use the state of the hooks instead of reloading everything, but for some reason its still needed.
  useFocusEffect(
    useCallback(() => {
      console.log('CirclesScreen: useFocusEffect triggered, calling loadCircles...');
      const refreshCircles = async () => {
        console.log('CirclesScreen: About to call loadCircles...');
        await loadCircles();
        await loadInterests();
        console.log('CirclesScreen: loadCircles completed');
      };
      refreshCircles();
    }, [loadCircles])
  );

  const toggleCircleExpansion = (circleId: string) => {
    const newExpanded = new Set(expandedCircles);
    if (newExpanded.has(circleId)) {
      newExpanded.delete(circleId);
    } else {
      newExpanded.add(circleId);
    }
    setExpandedCircles(newExpanded);
  };

  const handleDeleteCircle = (circleId: string, circleName: string) => {
    console.log('handleDeleteCircle called with:', circleId, circleName);
    setCircleToDelete({ id: circleId, name: circleName });
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!circleToDelete) return;
    
    setIsDeleting(true);
    console.log('Delete confirmed, calling deleteCircle API');
    const success = await deleteCircle(circleToDelete.id);
    console.log('Delete result:', success);
    
    setIsDeleting(false);
    setDeleteModalVisible(false);
    setCircleToDelete(null);
    
    // You could add a success/error toast here instead of Alert
    if (!success) {
      console.error('Failed to delete circle');
    }
  };

  const cancelDelete = () => {
    setDeleteModalVisible(false);
    setCircleToDelete(null);
  };

  const handleRemoveUser = (circleId: string, userId: string, userName: string, circleName: string) => {
    console.log('handleRemoveUser called with:', { circleId, userId, userName, circleName });
    setUserToRemove({ circleId, userId, userName, circleName });
    setRemoveUserModalVisible(true);
  };

  const confirmRemoveUser = async () => {
    if (!userToRemove) return;
    
    setIsRemovingUser(true);
    setRemovingUserId(userToRemove.userId);
    console.log('Remove user confirmed, calling removeUsersFromCircle API');
    const success = await removeUsersFromCircle(userToRemove.circleId, [userToRemove.userId]);
    console.log('Remove user result:', success);
    
    setIsRemovingUser(false);
    setRemovingUserId(null);
    setRemoveUserModalVisible(false);
    setUserToRemove(null);
    
    if (!success) {
      console.error('Failed to remove user from circle');
    }
  };

  const cancelRemoveUser = () => {
    setRemoveUserModalVisible(false);
    setUserToRemove(null);
    setRemovingUserId(null);
  };

  const toggleMenu = (circleId: string) => {
    setMenuVisible(menuVisible === circleId ? null : circleId);
  };

  const handleMenuAction = (action: 'rename' | 'delete' | 'convert', circleId: string, circleName: string) => {
    console.log('handleMenuAction called with:', action, circleId, circleName);
    setMenuVisible(null);
    
    if (action === 'delete') {
      console.log('Delete action selected, about to call handleDeleteCircle');
      console.log('Parameters:', { circleId, circleName });
      handleDeleteCircle(circleId, circleName);
    } else if (action === 'convert') {
      setCircleToConvert({ id: circleId, name: circleName });
      setConvertModalVisible(true);
    } else if (action === 'rename') {
      // TODO: Implement rename functionality
      console.log('Rename circle:', circleId, circleName);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header
          title="Circles"
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading circles...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Header
          title="Circles"
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={theme.colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Circles"
        onBackPress={() => navigation.goBack()}
      />
      
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={theme.colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search..."
          placeholderTextColor={theme.colors.inputPlaceholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {circles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={theme.colors.separator} />
            <Text style={styles.emptyTitle}>No Circles Yet</Text>
            <Text style={styles.emptyText}>You haven't joined any circles yet.</Text>
          </View>
        ) : (
          <>
            {/* My Circles Section */}
            {ownedCircles.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>My Circles ({ownedCircles.length})</Text>
                  <TouchableOpacity
                    style={styles.createCircleButton}
                    onPress={() => navigation.navigate('CreateCircle')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={16} color={theme.colors.primary} />
                    <Text style={styles.createCircleText}>New</Text>
                  </TouchableOpacity>
                </View>
                {ownedCircles.map((circle, index) => {
                  const isExpanded = expandedCircles.has(circle.id || '');
                  const isMenuOpen = menuVisible === circle.id;
                  const members = circle.members ?? [];
                  const previewMembers = members.slice(0, 3);
                  return (
                    <View key={circle.id} style={[
                      styles.circleCard,
                      isMenuOpen && { zIndex: 9999 + index, elevation: 9999 + index }
                    ]}>
                      <View style={styles.circleRow}>
                        <TouchableOpacity
                          style={styles.circleMainContent}
                          onPress={() => toggleCircleExpansion(circle.id || '')}
                          activeOpacity={0.7}
                        >
                          <View style={styles.circleIcon}>
                            <Ionicons
                              name={circle.isShared ? 'people' : 'person'}
                              size={18}
                              color={theme.colors.primary}
                            />
                          </View>
                          <View style={styles.circleInfo}>
                            <Text style={styles.circleName} numberOfLines={1}>{circle.name}</Text>
                            <View style={styles.circleSubtitleRow}>
                              {previewMembers.length > 0 && (
                                <View style={styles.stackedAvatars}>
                                  {previewMembers.map((m, idx) => (
                                    <View key={m.id} style={[styles.stackedAvatar, { marginLeft: idx > 0 ? -6 : 0, zIndex: 3 - idx }]}>
                                      <Avatar name={m.name || '?'} userId={m.id || ''} simple size={18} />
                                    </View>
                                  ))}
                                </View>
                              )}
                              <Text style={[styles.circleSubtext, previewMembers.length > 0 && { marginLeft: 4 }]}>
                                {members.length} {members.length === 1 ? 'member' : 'members'}
                                {circle.isShared ? ' · Shared' : ' · Private'}
                              </Text>
                              <Ionicons
                                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                size={14}
                                color={theme.colors.textMuted}
                                style={{ marginLeft: 2 }}
                              />
                            </View>
                          </View>
                        </TouchableOpacity>

                        <DropdownMenu
                          visible={menuVisible === circle.id}
                          onClose={() => toggleMenu(circle.id || '')}
                          triggerButton={
                            <TouchableOpacity
                              style={styles.menuButton}
                              onPress={() => toggleMenu(circle.id || '')}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons name="ellipsis-vertical" size={18} color={theme.colors.textMuted} />
                            </TouchableOpacity>
                          }
                          items={[
                            {
                              id: 'convert',
                              label: 'Convert to Interest',
                              icon: 'sparkles-outline',
                              onPress: () => handleMenuAction('convert', circle.id || '', circle.name || ''),
                            },
                            {
                              id: 'rename',
                              label: 'Rename Circle',
                              icon: 'pencil-outline',
                              onPress: () => handleMenuAction('rename', circle.id || '', circle.name || ''),
                            },
                            {
                              id: 'delete',
                              label: 'Delete Circle',
                              icon: 'trash-outline',
                              onPress: () => handleMenuAction('delete', circle.id || '', circle.name || ''),
                              destructive: true,
                            },
                          ]}
                        />
                      </View>

                      {isExpanded && (
                        <View style={styles.membersContainer}>
                          <View style={styles.membersHeader}>
                            <Text style={styles.membersTitle}>Members:</Text>
                            <TouchableOpacity
                              style={styles.addUserButton}
                              onPress={() => navigation.navigate('AddUsersToCircle', {
                                circleId: circle.id,
                                circleName: circle.name,
                                existingUserIds: circle.members?.map(m => m.id) || []
                              })}
                            >
                              <Ionicons name="person-add" size={20} color={theme.colors.primary} />
                              <Text style={styles.addUserButtonText}>Add User</Text>
                            </TouchableOpacity>
                          </View>
                          {circle.members && circle.members.length > 0 ? (
                            circle.members.map((member) => (
                              <View key={member.id} style={styles.memberItem}>
                                <Username
                                  user={member}
                                  navigation={navigation}
                                  styles={{
                                    container: styles.memberNameContainer,
                                    username: styles.memberName,
                                  }}
                                  showAvatar
                                />
                                {member.id !== user?.id && (
                                  <TouchableOpacity
                                    style={styles.removeUserButton}
                                    onPress={() => handleRemoveUser(circle.id || '', member.id || '', member.name || '', circle.name || '')}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    disabled={removingUserId === member.id}
                                  >
                                    {removingUserId === member.id ? (
                                      <ActivityIndicator size="small" color={theme.colors.textMuted} />
                                    ) : (
                                      <Ionicons name="close" size={18} color={theme.colors.textMuted} />
                                    )}
                                  </TouchableOpacity>
                                )}
                              </View>
                            ))
                          ) : (
                            <Text style={styles.noMembersText}>No members found</Text>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            )}

            {/* Circles Shared with Me Section */}
            {sharedCircles.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Shared with Me ({sharedCircles.length})</Text>
                </View>
                {sharedCircles.map((circle) => {
                  const isExpanded = expandedCircles.has(circle.id || '');
                  const owner = circle.owner;
                  const members = circle.members ?? [];
                  const previewMembers = members.slice(0, 3);
                  
                  return (
                    <View key={circle.id} style={styles.circleCard}>
                      <View style={styles.circleRow}>
                        <TouchableOpacity
                          style={styles.circleMainContent}
                          onPress={() => toggleCircleExpansion(circle.id || '')}
                          activeOpacity={0.7}
                        >
                          <View style={styles.circleIcon}>
                            <Ionicons
                              name={circle.isShared ? 'people' : 'person'}
                              size={18}
                              color={theme.colors.primary}
                            />
                          </View>
                          <View style={styles.circleInfo}>
                            <Text style={styles.circleName} numberOfLines={1}>{circle.name}</Text>
                            <View style={styles.circleSubtitleRow}>
                              {previewMembers.length > 0 && (
                                <View style={styles.stackedAvatars}>
                                  {previewMembers.map((m, idx) => (
                                    <View key={m.id} style={[styles.stackedAvatar, { marginLeft: idx > 0 ? -6 : 0, zIndex: 3 - idx }]}>
                                      <Avatar name={m.name || '?'} userId={m.id || ''} simple size={18} />
                                    </View>
                                  ))}
                                </View>
                              )}
                              <Text style={[styles.circleSubtext, previewMembers.length > 0 && { marginLeft: 4 }]}>
                                {members.length} {members.length === 1 ? 'member' : 'members'}
                                {owner ? ` · ${owner.name}` : ''}
                              </Text>
                              <Ionicons
                                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                size={14}
                                color={theme.colors.textMuted}
                                style={{ marginLeft: 2 }}
                              />
                            </View>
                          </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.leaveButton}
                          onPress={() => handleUnfollow('circle', circle.id || '', circle.name || '')}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={styles.leaveButtonText}>Leave</Text>
                        </TouchableOpacity>
                      </View>

                      {isExpanded && (
                        <View style={styles.membersContainer}>
                          <Text style={styles.membersTitle}>Members:</Text>
                          {circle.members && circle.members.length > 0 ? (
                            circle.members.map((member) => (
                              <View key={member.id} style={styles.memberItem}>
                                <Username
                                  user={member}
                                  navigation={navigation}
                                  styles={{
                                    container: styles.memberNameContainer,
                                    username: styles.memberName,
                                  }}
                                  showAvatar
                                />
                              </View>
                            ))
                          ) : (
                            <Text style={styles.noMembersText}>No members found</Text>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            )}

            {/* Interests Section */}
            {filteredInterests.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>My Interests ({filteredInterests.length})</Text>
                </View>
                {filteredInterests.map((interest) => (
                  <View key={interest.id} style={styles.circleCard}>
                    <View style={styles.circleRow}>
                      <View style={[styles.circleIcon, styles.interestIcon]}>
                        <Text style={styles.hashtagText}>#</Text>
                      </View>
                      <View style={styles.circleInfo}>
                        <Text style={styles.circleName} numberOfLines={1}>{interest.displayName}</Text>
                        <Text style={styles.circleSubtext}>
                          {(interest.friendsFollowingCount ?? 0) > 0
                            ? `${interest.friendsFollowingCount} ${interest.friendsFollowingCount === 1 ? 'friend follows' : 'friends follow'}`
                            : 'Following'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.leaveButton}
                        onPress={() => handleUnfollow('interest', interest.name || '', interest.displayName || '')}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.leaveButtonText}>Unfollow</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* Show message if nothing at all */}
            {ownedCircles.length === 0 && sharedCircles.length === 0 && filteredInterests.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={64} color={theme.colors.separator} />
                <Text style={styles.emptyTitle}>Nothing Here Yet</Text>
                <Text style={styles.emptyText}>You haven't joined any circles or followed any interests yet.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        visible={deleteModalVisible}
        title="Delete Circle"
        message={`Are you sure you want to delete "${circleToDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        isLoading={isDeleting}
        destructive={true}
      />

      {/* Convert to Interest Confirmation Modal */}
      <ConfirmationModal
        visible={convertModalVisible}
        title="Convert to Interest"
        message={`Convert "${circleToConvert?.name}" to an interest? All members will automatically follow the new interest and existing posts will be moved. The circle will be removed.`}
        confirmLabel="Convert"
        cancelLabel="Cancel"
        onConfirm={async () => {
          if (!circleToConvert) return;
          setIsConverting(true);
          const result = await convertCircleToInterest(circleToConvert.id);
          setIsConverting(false);
          setConvertModalVisible(false);
          setCircleToConvert(null);
          if (!result) {
            console.error('Failed to convert circle to interest');
          }
        }}
        onCancel={() => {
          setConvertModalVisible(false);
          setCircleToConvert(null);
        }}
        isLoading={isConverting}
      />

      {/* Remove User Confirmation Modal */}
      <ConfirmationModal
        visible={removeUserModalVisible}
        title="Remove User"
        message={`Are you sure you want to remove "${userToRemove?.userName}" from the circle "${userToRemove?.circleName}"?`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={confirmRemoveUser}
        onCancel={cancelRemoveUser}
        isLoading={isRemovingUser}
        destructive={true}
      />

      {/* Leave/Unfollow Confirmation Modal */}
      <ConfirmationModal
        visible={unfollowModalVisible}
        title={itemToUnfollow?.type === 'circle' ? 'Leave Circle' : 'Unfollow Interest'}
        message={itemToUnfollow?.type === 'circle'
          ? `Leave "${itemToUnfollow?.name}"? You won't see posts from this circle anymore.`
          : `Unfollow #${itemToUnfollow?.name}? You won't see posts tagged with this interest anymore.`}
        confirmLabel={itemToUnfollow?.type === 'circle' ? 'Leave' : 'Unfollow'}
        cancelLabel="Cancel"
        onConfirm={confirmUnfollow}
        onCancel={() => { setUnfollowModalVisible(false); setItemToUnfollow(null); }}
        isLoading={isUnfollowing}
        destructive={true}
      />
    </SafeAreaView>
  );
};

// makeStyles at bottom
const useStyles = makeStyles((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.backgroundAlt },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.textPrimary,
    padding: 0,
  },
  content: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  createCircleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.primary + '40',
    borderStyle: 'dashed',
    gap: 3,
  },
  createCircleText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: theme.colors.textSecondary },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { marginTop: 16, fontSize: 16, color: theme.colors.danger, textAlign: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: theme.colors.textPrimary, marginTop: 16 },
  emptyText: { fontSize: 16, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8 },
  circleCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'visible',
    zIndex: 1,
  },
  circleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  circleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  circleMainContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  circleInfo: { flex: 1 },
  circleName: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary },
  circleSubtitleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  circleSubtext: { fontSize: 12, color: theme.colors.textMuted },
  stackedAvatars: { flexDirection: 'row', alignItems: 'center' },
  stackedAvatar: { borderRadius: 9, borderWidth: 1.5, borderColor: theme.colors.card, overflow: 'hidden' },
  menuButton: { padding: 6, marginLeft: 4 },
  leaveButton: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.textMuted + '40', marginRight: 14 },
  leaveButtonText: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted },
  interestIcon: { backgroundColor: theme.colors.accent + '15' },
  hashtagText: { fontSize: 17, fontWeight: '700', color: theme.colors.accent },
  membersContainer: { paddingHorizontal: 14, paddingBottom: 12, borderTopWidth: 1, borderTopColor: theme.colors.separator + '40' },
  membersHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 8 },
  membersTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  addUserButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.primary + '40', borderStyle: 'dashed', gap: 4 },
  addUserButtonText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  memberItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  memberNameContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  memberName: { fontSize: 15, color: theme.colors.textPrimary },
  removeUserButton: { padding: 4, marginLeft: 8 },
  noMembersText: { fontSize: 14, color: theme.colors.textMuted, fontStyle: 'italic' },
}));

export default CirclesScreen;
