import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCirclesWithMembers } from '../hooks/useCircle';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';
import Username from 'components/Username';

const CirclesScreen = ({ navigation }) => {
  const { 
    circles, 
    isLoading, 
    error, 
    deleteCircle, 
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
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [removeUserModalVisible, setRemoveUserModalVisible] = useState(false);
  const [userToRemove, setUserToRemove] = useState<{circleId: string, userId: string, userName: string, circleName: string} | null>(null);
  const [isRemovingUser, setIsRemovingUser] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  //Refresh circles when screen comes into focus
  // TODO - This could be optimized to use the state of the hooks instead of reloading everything, but for some reason its still needed.
  useFocusEffect(
    useCallback(() => {
      console.log('CirclesScreen: useFocusEffect triggered, calling loadCircles...');
      const refreshCircles = async () => {
        console.log('CirclesScreen: About to call loadCircles...');
        await loadCircles();
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

  const handleMenuAction = (action: 'rename' | 'delete', circleId: string, circleName: string) => {
    console.log('handleMenuAction called with:', action, circleId, circleName);
    setMenuVisible(null);
    
    if (action === 'delete') {
      console.log('Delete action selected, about to call handleDeleteCircle');
      console.log('Parameters:', { circleId, circleName });
      handleDeleteCircle(circleId, circleName);
    } else if (action === 'rename') {
      // TODO: Implement rename functionality
      console.log('Rename circle:', circleId, circleName);
    }
  };

  // Separate owned and shared circles
  const ownedCircles = circles.filter(circle => circle.isOwner);
  const sharedCircles = circles.filter(circle => !circle.isOwner);

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
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity 
          style={styles.scrollContent} 
          activeOpacity={1} 
          onPress={() => setMenuVisible(null)}
        >
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
                  <Text style={styles.sectionTitle}>My Circles</Text>
                </View>
                {ownedCircles.map((circle, index) => {
                  const isExpanded = expandedCircles.has(circle.id || '');
                  const isMenuOpen = menuVisible === circle.id;
                  return (
                    <View key={circle.id} style={[
                      styles.circleCard,
                      isMenuOpen && { zIndex: 9999 + index, elevation: 9999 + index }
                    ]}>
                      <View style={styles.circleHeader}>
                        <TouchableOpacity
                          style={styles.circleMainContent}
                          onPress={() => toggleCircleExpansion(circle.id || '')}
                          activeOpacity={0.7}
                        >
                          <View style={styles.circleInfo}>
                            <View style={styles.circleTitleRow}>
                              <Text style={styles.circleName}>{circle.name}</Text>
                            </View>
                            <View style={styles.circleDetails}>
                              <Text style={styles.circleType}>
                                {circle.isShared ? 'Shared Circle' : 'Private Circle'}
                              </Text>
                              <Text style={styles.memberCount}>
                                {circle.members?.length || 0} members
                              </Text>
                            </View>
                          </View>
                          <Ionicons
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={24}
                            color={theme.colors.textMuted}
                          />
                        </TouchableOpacity>
                        
                        <View style={styles.menuContainer}>
                          <TouchableOpacity
                            style={styles.menuButton}
                            onPress={() => toggleMenu(circle.id || '')}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.textMuted} />
                          </TouchableOpacity>
                          
                          {menuVisible === circle.id && (
                            <View style={styles.menuDropdown}>
                              <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => handleMenuAction('rename', circle.id || '', circle.name || '')}
                              >
                                <Ionicons name="pencil-outline" size={16} color={theme.colors.textPrimary} />
                                <Text style={styles.menuItemText}>Rename Circle</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.menuItem, styles.deleteMenuItem]}
                                onPress={() => {
                                  console.log('Delete menu item pressed for circle:', circle.id, circle.name);
                                  handleMenuAction('delete', circle.id || '', circle.name || '');
                                }}
                              >
                                <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
                                <Text style={[styles.menuItemText, styles.deleteMenuItemText]}>Delete Circle</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
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
                  <Text style={styles.sectionTitle}>Circles Shared with Me</Text>
                </View>
                {sharedCircles.map((circle) => {
                  const isExpanded = expandedCircles.has(circle.id || '');
                  // Find the owner from the members list
                  const owner = circle.owner
                  
                  return (
                    <View key={circle.id} style={styles.circleCard}>
                      <TouchableOpacity
                        style={styles.circleHeader}
                        onPress={() => toggleCircleExpansion(circle.id || '')}
                        activeOpacity={0.7}
                      >
                        <View style={styles.circleInfo}>
                          <View style={styles.circleTitleRow}>
                            <Text style={styles.circleName}>{circle.name}</Text>
                          </View>
                          <View style={styles.circleDetails}>
                            <Text style={styles.circleType}>
                              {circle.isShared ? 'Shared Circle' : 'Private Circle'}
                            </Text>
                            <Text style={styles.memberCount}>
                              {circle.members?.length || 0} members
                            </Text>
                          </View>
                          {owner && (
                            <Text style={styles.ownerInfo}>
                              Owner: {owner.name}
                            </Text>
                          )}
                        </View>
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={24}
                          color={theme.colors.textMuted}
                        />
                      </TouchableOpacity>

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

            {/* Show message if no circles at all */}
            {ownedCircles.length === 0 && sharedCircles.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={64} color={theme.colors.separator} />
                <Text style={styles.emptyTitle}>No Circles Yet</Text>
                <Text style={styles.emptyText}>You haven't joined any circles yet.</Text>
              </View>
            )}
          </>
        )}
        </TouchableOpacity>
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelDelete}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={24} color={theme.colors.danger} />
              <Text style={styles.modalTitle}>Delete Circle</Text>
            </View>
            
            <Text style={styles.modalMessage}>
              Are you sure you want to delete "{circleToDelete?.name}"? This action cannot be undone.
            </Text>
            
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={cancelDelete}
                disabled={isDeleting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              
              <Pressable
                style={[styles.modalButton, styles.modalDeleteButton]}
                onPress={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={theme.colors.primaryContrast} />
                ) : (
                  <Text style={styles.deleteButtonText}>Delete</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Remove User Confirmation Modal */}
      <Modal
        visible={removeUserModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelRemoveUser}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={24} color={theme.colors.danger} />
              <Text style={styles.modalTitle}>Remove User</Text>
            </View>
            
            <Text style={styles.modalMessage}>
              Are you sure you want to remove "{userToRemove?.userName}" from the circle "{userToRemove?.circleName}"?
            </Text>
            
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={cancelRemoveUser}
                disabled={isRemovingUser}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              
              <Pressable
                style={[styles.modalButton, styles.modalDeleteButton]}
                onPress={confirmRemoveUser}
                disabled={isRemovingUser}
              >
                {isRemovingUser ? (
                  <ActivityIndicator size="small" color={theme.colors.primaryContrast} />
                ) : (
                  <Text style={styles.deleteButtonText}>Remove</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// makeStyles at bottom
const useStyles = makeStyles((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.backgroundAlt },
  content: { flex: 1, padding: 16 },
  scrollContent: { flex: 1 },
  sectionHeader: { paddingVertical: 16, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 8 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: theme.colors.textSecondary },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { marginTop: 16, fontSize: 16, color: theme.colors.danger, textAlign: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: theme.colors.textPrimary, marginTop: 16 },
  emptyText: { fontSize: 16, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8 },
  circleCard: { backgroundColor: theme.colors.card, borderRadius: 12, marginBottom: 16, shadowColor: theme.colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, overflow: 'visible', zIndex: 1, borderWidth: 1, borderColor: theme.colors.separator },
  circleHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  circleInfo: { flex: 1 },
  circleMainContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  menuContainer: { position: 'relative' },
  menuButton: { padding: 8 },
  menuDropdown: { position: 'absolute', top: 36, right: 0, backgroundColor: theme.colors.card, borderRadius: 8, minWidth: 150, shadowColor: theme.colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 20, borderWidth: 1, borderColor: theme.colors.separator, zIndex: 10000 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.separator },
  deleteMenuItem: { borderBottomWidth: 0 },
  menuItemText: { fontSize: 14, color: theme.colors.textPrimary, marginLeft: 12, fontWeight: '500' },
  deleteMenuItemText: { color: theme.colors.danger },
  circleActions: { flexDirection: 'row', alignItems: 'center' },
  deleteButton: { backgroundColor: theme.colors.danger },
  circleTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  circleName: { fontSize: 18, fontWeight: '600', color: theme.colors.textPrimary, flex: 1 },
  ownerBadge: { backgroundColor: theme.colors.primary, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8 },
  ownerBadgeText: { fontSize: 12, fontWeight: '600', color: theme.colors.primaryContrast },
  memberBadge: { backgroundColor: theme.colors.accent, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8 },
  memberBadgeText: { fontSize: 12, fontWeight: '600', color: theme.colors.primaryContrast },
  circleDetails: { flexDirection: 'row', alignItems: 'center' },
  circleType: { fontSize: 14, color: theme.colors.textMuted, marginRight: 16 },
  memberCount: { fontSize: 14, color: theme.colors.primary, fontWeight: '500' },
  ownerInfo: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 4, fontStyle: 'italic' },
  membersContainer: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: theme.colors.separator },
  membersHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 },
  membersTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary },
  addUserButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.colors.backgroundAlt, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.primary },
  addUserButtonText: { fontSize: 14, fontWeight: '500', color: theme.colors.primary, marginLeft: 6 },
  memberItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  memberNameContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  memberName: { fontSize: 16, color: theme.colors.textPrimary },
  removeUserButton: { padding: 4, marginLeft: 8 },
  noMembersText: { fontSize: 14, color: theme.colors.textMuted, fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 24, width: '90%', maxWidth: 400, shadowColor: theme.colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '600', color: theme.colors.textPrimary, marginLeft: 12 },
  modalMessage: { fontSize: 16, color: theme.colors.textSecondary, lineHeight: 24, marginBottom: 24 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  modalButton: { flex: 1, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  cancelButton: { backgroundColor: theme.colors.backgroundAlt, borderWidth: 1, borderColor: theme.colors.separator },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary },
  modalDeleteButton: { backgroundColor: theme.colors.danger },
  deleteButtonText: { fontSize: 16, fontWeight: '600', color: theme.colors.primaryContrast },
}));

export default CirclesScreen;
