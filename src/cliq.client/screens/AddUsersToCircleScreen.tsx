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
import { useFriends } from '../hooks/useFriends';
import { useCirclesWithMembers } from '../hooks/useCircle';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';

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
  const { theme } = useTheme();
  const styles = useStyles();
  const { circleId, circleName, existingUserIds } = route.params;
  const { friends, isLoading, error } = useFriends();
  const { addUsersToCircle, isAddingUser: isSubmitting } = useCirclesWithMembers();
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
    <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Users</Text>
        </View>
        <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
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
    <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Users</Text>
        </View>
        <View style={styles.errorContainer}>
      <Ionicons name="alert-circle" size={48} color={theme.colors.danger} />
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
          <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add to "{circleName}"</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search friends..."
          value={searchText}
          onChangeText={setSearchText}
          placeholderTextColor={theme.colors.inputPlaceholder}
        />
        {searchText.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setSearchText('')}
          >
            <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
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
            <Ionicons name="people-outline" size={64} color={theme.colors.separator} />
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
                      <Ionicons name="checkmark-circle" size={24} color={theme.colors.separator} />
                    ) : (
                      <Ionicons 
                        name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
                        size={24} 
                        color={isSelected ? theme.colors.primary : theme.colors.separator} 
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
              <ActivityIndicator size="small" color={theme.colors.primaryContrast} />
            ) : (
              <>
                <Ionicons name="person-add" size={20} color={theme.colors.primaryContrast} />
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
// makeStyles at bottom
const useStyles = makeStyles((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.backgroundAlt },
  header: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: theme.colors.separator,
    elevation: 2, shadowColor: theme.colors.shadow, shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: 16, flex: 1, color: theme.colors.textPrimary },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.card, margin: 16,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.separator,
  },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, fontSize: 16, color: theme.colors.textPrimary },
  clearButton: { padding: 4 },
  friendsList: { flex: 1, paddingHorizontal: 16 },
  friendsListContent: { paddingBottom: 20, flexGrow: 1 },
  friendItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.card, padding: 16,
    borderRadius: 12, marginBottom: 12, shadowColor: theme.colors.shadow, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  friendItemDisabled: { backgroundColor: theme.colors.backgroundAlt, opacity: 0.6 },
  friendItemSelected: { borderWidth: 2, borderColor: theme.colors.primary, backgroundColor: theme.colors.backgroundAlt },
  friendInfo: { flex: 1, marginLeft: 12 },
  friendName: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary },
  friendNameDisabled: { color: theme.colors.textMuted },
  alreadyInCircleText: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2, fontStyle: 'italic' },
  selectionContainer: { padding: 4 },
  bottomSection: { padding: 16, backgroundColor: theme.colors.card, borderTopWidth: 1, borderTopColor: theme.colors.separator },
  addButton: {
    backgroundColor: theme.colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, paddingHorizontal: 24, borderRadius: 12, shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
  },
  addButtonDisabled: { backgroundColor: theme.colors.separator, shadowOpacity: 0 },
  addButtonText: { fontSize: 16, fontWeight: '600', color: theme.colors.primaryContrast, marginLeft: 8 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: theme.colors.textSecondary },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { marginTop: 16, fontSize: 16, color: theme.colors.danger, textAlign: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: theme.colors.textPrimary, marginTop: 16 },
  emptyText: { fontSize: 16, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8 },
}));

export default AddUsersToCircleScreen;
