import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../components/Avatar';
import { useFriends, useAddUsersToCircle } from '../hooks/useFriends';

interface AddUsersToCircleScreenProps {
  navigation: any;
  route: {
    params: {
      circleId: string;
      circleName: string;
      existingUserIds: string[];
    };
  };
}

const AddUsersToCircleScreen: React.FC<AddUsersToCircleScreenProps> = ({ navigation, route }) => {
  const { circleId, circleName, existingUserIds } = route.params;
  const { friends, isLoading, error } = useFriends();
  const { addUsersToCircle, isLoading: isSubmitting } = useAddUsersToCircle();
  const [searchText, setSearchText] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  // Filter friends based on search text
  const filteredFriends = friends.filter(friend =>
    friend.name?.toLowerCase().includes(searchText.toLowerCase())
  );

  const toggleUserSelection = (userId: string) => {
    if (existingUserIds.includes(userId)) {
      return; // Cannot select users already in the circle
    }

    const newSelected = new Set(selectedUserIds);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUserIds(newSelected);
  };

  const handleAddUsers = async () => {
    if (selectedUserIds.size === 0) {
      return;
    }

    const success = await addUsersToCircle(circleId, Array.from(selectedUserIds));
    
    if (success) {
      // Navigate back on success
      navigation.goBack();
    }
  };

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
          <Text style={styles.headerTitle}>Add Users</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1DA1F2" />
          <Text style={styles.loadingText}>Loading friends...</Text>
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
          <Text style={styles.headerTitle}>Add Users</Text>
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
        <Text style={styles.headerTitle}>Add to "{circleName}"</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search friends..."
          value={searchText}
          onChangeText={setSearchText}
          placeholderTextColor="#999999"
        />
        {searchText.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setSearchText('')}
          >
            <Ionicons name="close-circle" size={20} color="#999999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Friends List */}
      <ScrollView 
        style={styles.friendsList} 
        contentContainerStyle={styles.friendsListContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredFriends.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#CCCCCC" />
            <Text style={styles.emptyTitle}>
              {searchText ? 'No friends found' : 'No friends available'}
            </Text>
            <Text style={styles.emptyText}>
              {searchText 
                ? 'Try adjusting your search terms'
                : 'Add some friends to start creating circles'
              }
            </Text>
          </View>
        ) : (
          <>
            {filteredFriends.map((friend) => {
              const isInCircle = existingUserIds.includes(friend.id);
              const isSelected = selectedUserIds.has(friend.id);
              
              return (
                <TouchableOpacity
                  key={friend.id}
                  style={[
                    styles.friendItem,
                    isInCircle && styles.friendItemDisabled,
                    isSelected && styles.friendItemSelected,
                  ]}
                  onPress={() => toggleUserSelection(friend.id)}
                  disabled={isInCircle}
                  activeOpacity={isInCircle ? 1 : 0.7}
                >
                  <Avatar
                    name={friend.name || ''}
                    userId={friend.id}
                  />
                  <View style={styles.friendInfo}>
                    <Text style={[
                      styles.friendName,
                      isInCircle && styles.friendNameDisabled
                    ]}>
                      {friend.name}
                    </Text>
                    {isInCircle && (
                      <Text style={styles.alreadyInCircleText}>
                        Already in circle
                      </Text>
                    )}
                  </View>
                  
                  <View style={styles.selectionContainer}>
                    {isInCircle ? (
                      <Ionicons name="checkmark-circle" size={24} color="#CCCCCC" />
                    ) : (
                      <Ionicons 
                        name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
                        size={24} 
                        color={isSelected ? "#1DA1F2" : "#CCCCCC"} 
                      />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Add Users Button */}
      {selectedUserIds.size > 0 && (
        <View style={styles.bottomSection}>
          <Pressable
            style={[
              styles.addButton,
              isSubmitting && styles.addButtonDisabled
            ]}
            onPress={handleAddUsers}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="person-add" size={20} color="#FFFFFF" />
                <Text style={styles.addButtonText}>
                  Add {selectedUserIds.size} {selectedUserIds.size === 1 ? 'User' : 'Users'}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
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
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E8ED',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
  },
  clearButton: {
    padding: 4,
  },
  friendsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  friendsListContent: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  friendItemDisabled: {
    backgroundColor: '#F8F9FA',
    opacity: 0.6,
  },
  friendItemSelected: {
    borderWidth: 2,
    borderColor: '#1DA1F2',
    backgroundColor: '#F0F8FF',
  },
  friendInfo: {
    flex: 1,
    marginLeft: 12,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  friendNameDisabled: {
    color: '#999999',
  },
  alreadyInCircleText: {
    fontSize: 12,
    color: '#999999',
    marginTop: 2,
    fontStyle: 'italic',
  },
  selectionContainer: {
    padding: 4,
  },
  bottomSection: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E1E8ED',
  },
  addButton: {
    backgroundColor: '#1DA1F2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#1DA1F2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonDisabled: {
    backgroundColor: '#CCCCCC',
    shadowOpacity: 0,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
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
});

export default AddUsersToCircleScreen;
