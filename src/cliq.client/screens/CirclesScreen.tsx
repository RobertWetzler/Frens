import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCirclesWithMembers } from '../hooks/useCircle';

const CirclesScreen = ({ navigation }) => {
  const { circles, isLoading, error, deleteCircle } = useCirclesWithMembers();
  const [expandedCircles, setExpandedCircles] = useState<Set<string>>(new Set());
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [circleToDelete, setCircleToDelete] = useState<{id: string, name: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);

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
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#1DA1F2" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Circles</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1DA1F2" />
          <Text style={styles.loadingText}>Loading circles...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#1DA1F2" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Circles</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#FF6B6B" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1DA1F2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Circles</Text>
      </View>
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity 
          style={styles.scrollContent} 
          activeOpacity={1} 
          onPress={() => setMenuVisible(null)}
        >
          {circles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#CCCCCC" />
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
                            color="#666666"
                          />
                        </TouchableOpacity>
                        
                        <View style={styles.menuContainer}>
                          <TouchableOpacity
                            style={styles.menuButton}
                            onPress={() => toggleMenu(circle.id || '')}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Ionicons name="ellipsis-horizontal" size={20} color="#666666" />
                          </TouchableOpacity>
                          
                          {menuVisible === circle.id && (
                            <View style={styles.menuDropdown}>
                              <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => handleMenuAction('rename', circle.id || '', circle.name || '')}
                              >
                                <Ionicons name="pencil-outline" size={16} color="#333333" />
                                <Text style={styles.menuItemText}>Rename Circle</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.menuItem, styles.deleteMenuItem]}
                                onPress={() => {
                                  console.log('Delete menu item pressed for circle:', circle.id, circle.name);
                                  handleMenuAction('delete', circle.id || '', circle.name || '');
                                }}
                              >
                                <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                                <Text style={[styles.menuItemText, styles.deleteMenuItemText]}>Delete Circle</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      </View>

                      {isExpanded && (
                        <View style={styles.membersContainer}>
                          <Text style={styles.membersTitle}>Members:</Text>
                          {circle.members && circle.members.length > 0 ? (
                            circle.members.map((member) => (
                              <View key={member.id} style={styles.memberItem}>
                                <View style={styles.memberAvatar}>
                                  <Text style={styles.memberAvatarText}>
                                    {member.name?.charAt(0).toUpperCase() || '?'}
                                  </Text>
                                </View>
                                <Text style={styles.memberName}>{member.name}</Text>
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
                          color="#666666"
                        />
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={styles.membersContainer}>
                          <Text style={styles.membersTitle}>Members:</Text>
                          {circle.members && circle.members.length > 0 ? (
                            circle.members.map((member) => (
                              <View key={member.id} style={styles.memberItem}>
                                <View style={styles.memberAvatar}>
                                  <Text style={styles.memberAvatarText}>
                                    {member.name?.charAt(0).toUpperCase() || '?'}
                                  </Text>
                                </View>
                                <Text style={styles.memberName}>{member.name}</Text>
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
                <Ionicons name="people-outline" size={64} color="#CCCCCC" />
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
              <Ionicons name="warning" size={24} color="#FF6B6B" />
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
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.deleteButtonText}>Delete</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e4e8',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 16,
  },
  content: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    flex: 1,
  },
  sectionHeader: {
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FF6B6B',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginTop: 8,
  },
  circleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'visible',
    zIndex: 1,
  },
  circleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  circleInfo: {
    flex: 1,
  },
  circleMainContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuContainer: {
    position: 'relative',
  },
  menuButton: {
    padding: 8,
  },
  menuDropdown: {
    position: 'absolute',
    top: 36,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    minWidth: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10000,
    borderWidth: 1,
    borderColor: '#E1E8ED',
    zIndex: 10000,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
  },
  deleteMenuItem: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    fontSize: 14,
    color: '#333333',
    marginLeft: 12,
    fontWeight: '500',
  },
  deleteMenuItemText: {
    color: '#FF6B6B',
  },
  circleActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#FF6B6B',
  },
  circleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  circleName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    flex: 1,
  },
  ownerBadge: {
    backgroundColor: '#1DA1F2',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  ownerBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  memberBadge: {
    backgroundColor: '#28A745',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  memberBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  circleDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  circleType: {
    fontSize: 14,
    color: '#666666',
    marginRight: 16,
  },
  memberCount: {
    fontSize: 14,
    color: '#1DA1F2',
    fontWeight: '500',
  },
  ownerInfo: {
    fontSize: 13,
    color: '#888888',
    marginTop: 4,
    fontStyle: 'italic',
  },
  membersContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#E1E8ED',
  },
  membersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
    marginTop: 8,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1DA1F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  memberName: {
    fontSize: 16,
    color: '#333333',
  },
  noMembersText: {
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginLeft: 12,
  },
  modalMessage: {
    fontSize: 16,
    color: '#666666',
    lineHeight: 24,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E1E8ED',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  modalDeleteButton: {
    backgroundColor: '#FF6B6B',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default CirclesScreen;
