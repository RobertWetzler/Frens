import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@rneui/base';
import { useNotifications } from 'hooks/useNotifications';
import { FriendRequestDto } from 'services/generated/generatedClient';
import { ApiClient } from 'services/apiClient';

interface NotificationsScreenProps {
  navigation: any;
}

const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ navigation }) => {
  const { notifications, isLoading, error, loadNotifications } = useNotifications();

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    // For older dates, show month/day
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    try {
      await ApiClient.call(c => c.frenship_AcceptFriendRequest(friendshipId));
      // Reload notifications to update the list
      loadNotifications();
    } catch (err) {
      console.error('Error accepting friend request:', err);
    }
  };

  const handleDenyRequest = async (friendshipId: string) => {
    try {
      await ApiClient.call(c => c.frenship_RejectFriendRequest(friendshipId));
      // Reload notifications to update the list
      loadNotifications();
    } catch (err) {
      console.error('Error denying friend request:', err);
    }
  };

  const handleAvatarPress = (userId: string) => {
    navigation.navigate('Profile', { userId });
  };

  const renderFriendRequest = ({ item }: { item: FriendRequestDto }) => (
    <View style={styles.notificationItem}>
      <TouchableOpacity 
        onPress={() => handleAvatarPress(item.requesterId)}
        style={styles.avatarContainer}
      >
        <Avatar
          rounded
          size="medium"
          overlayContainerStyle={{ backgroundColor: '#73cbff' }}
          title={item.requester?.name?.charAt(0).toUpperCase() || '?'}
          // Uncomment when user images are available
          // source={{ uri: item.requester?.imageUrl }}
        />
      </TouchableOpacity>
      
      <View style={styles.notificationContent}>
        <View style={styles.notificationText}>
          <Text style={styles.userName}>{item.requester?.name || 'Unknown User'}</Text>
          <Text style={styles.actionText}> sent you a friend request</Text>
        </View>
        <Text style={styles.timeText}>{formatDate(item.createdAt!)}</Text>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => handleAcceptRequest(item.id)}
          >
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.denyButton}
            onPress={() => handleDenyRequest(item.id)}
          >
            <Text style={styles.denyButtonText}>Deny</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // Sort friend requests by date (most recent first)
  const sortedFriendRequests = notifications?.friendRequests?.sort((a, b) => {
    if (!a.createdAt || !b.createdAt) return 0;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }) || [];

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
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.placeholder} />
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1DA1F2" />
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
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.placeholder} />
        </View>
        
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadNotifications}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.placeholder} />
      </View>
      
      {sortedFriendRequests.length > 0 ? (
        <FlatList
          data={sortedFriendRequests}
          renderItem={renderFriendRequest}
          keyExtractor={item => item.id}
          style={styles.list}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>
            No notifications yet
          </Text>
          <Text style={styles.emptySubText}>
            You'll see friend requests and other notifications here when they arrive.
          </Text>
        </View>
      )}
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e4e8',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40, // Same width as back button for centering
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#1DA1F2',
    borderRadius: 20,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  list: {
    flex: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
    alignItems: 'flex-start',
  },
  avatarContainer: {
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationText: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#1DA1F2',
  },
  actionText: {
    fontSize: 16,
    color: '#333',
  },
  timeText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  acceptButton: {
    backgroundColor: '#1DA1F2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: 70,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  denyButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1DA1F2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: 70,
    alignItems: 'center',
  },
  denyButtonText: {
    color: '#1DA1F2',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default NotificationsScreen;