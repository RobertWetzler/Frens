import React from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@rneui/base';
import { useNotificationFeed } from 'hooks/useNotifications';
import { FollowCircleRequest, FriendRequestDto, NotificationDto, NotificationFeedDto } from 'services/generated/generatedClient';
import { ApiClient } from 'services/apiClient';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';

interface NotificationsScreenProps { navigation: any; }

interface IEnrichedNotification { metadata: any; fromId: string; fromName: string; createdAt}
class NewSubscribableCircle implements IEnrichedNotification {
  id: string;
  fromId: string;
  fromName: string;
  circleId: string;
  circleName: string;
  isAlreadyMember: boolean;
  metadata: any;
  createdAt: any;
  constructor(id, fromid, fromName, circleId, circleName, isAlreadyMember, createdAt, metadata)
  {
    this.id = id
    this.fromId = fromid
    this.fromName = fromName
    this.circleId = circleId
    this.circleName = circleName
    this.isAlreadyMember = isAlreadyMember
    this.createdAt = createdAt
    this.metadata = metadata
  }
}

class InterestDiscoveryNotification implements IEnrichedNotification {
  id: string;
  fromId: string;
  fromName: string;
  interestId: string;
  interestName: string;
  interestDisplayName: string;
  friendCount: number;
  metadata: any;
  createdAt: any;
  constructor(id, fromId, fromName, interestId, interestName, interestDisplayName, friendCount, createdAt, metadata) {
    this.id = id
    this.fromId = fromId
    this.fromName = fromName
    this.interestId = interestId
    this.interestName = interestName
    this.interestDisplayName = interestDisplayName
    this.friendCount = friendCount
    this.createdAt = createdAt
    this.metadata = metadata
  }
}

// class NewComment implements IEnrichedNotification {
//   fromId: string;
//   fromName: string;
//   commentId: string;
//   postId: string;
//   commentText: string;
//   metadata: any;

//   constructor(fromid, fromName, commentId, postId, commentText, metadata)
//   {
//     this.fromId = fromid
//     this.fromName = fromName
//     this.commentId = commentId
//     this.postId = postId
//     this.commentText = commentText
//     this.metadata = metadata
//   }
// }

const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ navigation }) => {
  const { notificationFeed: notificationFeed, processedNotifications: processedNotifications, isLoading, error, loadNotifications: loadNotificationFeed } = useNotificationFeed();
  const { theme } = useTheme();
  const styles = useStyles();

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    try { await ApiClient.call(c => c.frenship_AcceptFriendRequest(friendshipId)); loadNotificationFeed(); } catch (e) { console.error(e); }
  };
  const handleDenyRequest = async (friendshipId: string) => {
    try { await ApiClient.call(c => c.frenship_RejectFriendRequest(friendshipId)); loadNotificationFeed(); } catch (e) { console.error(e); }
  };

  const handleFollowCircleRequest = async (circleId: string, notificationId: string) => {
    try { await ApiClient.call(c => c.circle_FollowCircle(new FollowCircleRequest({circleId, notificationId}))); loadNotificationFeed(); } catch (e) { console.error(e); }
  };

  const handleDenyFollowCircleRequest = async (notificationId: string) => {
    try { await ApiClient.call(c => c.circle_DenyFollowCircle(notificationId)); loadNotificationFeed(); } catch (e) { console.error(e); }
  };
  const handleAvatarPress = (userId: string) => navigation.navigate('Profile', { userId });

  const handleFollowInterest = async (interestName: string) => {
    try {
      const { FollowInterestRequest } = await import('services/generated/generatedClient');
      await ApiClient.call(c => c.interest_FollowInterest(interestName, new FollowInterestRequest()));
      loadNotificationFeed();
    } catch (e) { console.error('Failed to follow interest:', e); }
  };

  const sortedFriendRequests = notificationFeed?.friendRequests?.slice().sort((a, b) => {
    if (!a.createdAt || !b.createdAt) return 0; return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }) || [];

  const sortedNotifications = notificationFeed?.notifications?.slice().sort((a, b) => {
    if (!a.createdAt || !b.createdAt) return 0; return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }) || [];

  // const sortedCombinedFeed: (FriendRequestDto | NewSubscribableCircle)[] = [];
  // sortedCombinedFeed.concat(processedNotifications);
  // sortedCombinedFeed.concat(notificationFeed.friendRequests);
  // sortedCombinedFeed.sort((a, b) => {
  //   if (!a.createdAt || !b.createdAt) return 0; return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  // }) || [];

  const sortedCombinedFeed: (FriendRequestDto | NewSubscribableCircle)[] = (processedNotifications as (NewSubscribableCircle | FriendRequestDto)[] || [])
                                                                            .concat(notificationFeed?.friendRequests || [])
                                                                            .sort((a,b) => {if (!a.createdAt || !b.createdAt) return 0; return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); })
                                                                            || [];
  console.log("Sorted combined feed: ", sortedCombinedFeed)
  console.log("First instance ofs", sortedCombinedFeed[0] instanceof NewSubscribableCircle, sortedCombinedFeed[0] instanceof FriendRequestDto, typeof sortedCombinedFeed[0], typeof sortedCombinedFeed[1])
  console.log("First instance ofs", sortedCombinedFeed[1] instanceof NewSubscribableCircle, sortedCombinedFeed[1] instanceof FriendRequestDto, typeof sortedCombinedFeed[1], typeof sortedCombinedFeed[1])


  const renderFriendRequest = ({ item }: { item: FriendRequestDto }) => (
    <View style={styles.notificationItem}>
      <TouchableOpacity onPress={() => handleAvatarPress(item.requesterId)} style={styles.avatarContainer}>
        <Avatar rounded size="medium" overlayContainerStyle={{ backgroundColor: theme.colors.accent }} title={item.requester?.name?.charAt(0).toUpperCase() || '?'} />
      </TouchableOpacity>
      <View style={styles.notificationContent}>
        <View style={styles.notificationText}>
          <Text style={styles.userName}>{item.requester?.name || 'Unknown User'}</Text>
          <Text style={styles.actionText}> sent you a friend request</Text>
        </View>
        <Text style={styles.timeText}>{item.createdAt ? formatDate(new Date(item.createdAt)) : ''}</Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.acceptButton} onPress={() => handleAcceptRequest(item.id)}>
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.denyButton} onPress={() => handleDenyRequest(item.id)}>
            <Text style={styles.denyButtonText}>Deny</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderNotifications = ({ item }: { item: any }) => (
      <View>
      { item.requesterId ? (
        renderFriendRequest({item})
      ) : item.metadata?.Type === 'InterestDiscovery' ? (
        renderInterestDiscovery({item})
      ) : (
        renderNewSubscribableCircle({item})
      )}
      </View>)
    ;


  const renderNewSubscribableCircle = ({ item }: { item: (NewSubscribableCircle)}) => (
    <View style={styles.notificationItem}>
      <TouchableOpacity onPress={() => handleAvatarPress(item.fromId)} style={styles.avatarContainer}>
        <Avatar rounded size="medium" overlayContainerStyle={{ backgroundColor: theme.colors.accent }} title={item.fromName?.charAt(0).toUpperCase() || '?'} />
      </TouchableOpacity>
      <View style={styles.notificationContent}>
        <View style={styles.notificationText}>
          <Text style={styles.userName}>{item.fromName || 'Unknown User'} </Text>
          <Text style={styles.actionText}>created a circle you can follow: </Text>
          <Text style={styles.boldText}>{item.circleName}</Text>
        </View>
        <Text style={styles.timeText}>{item.createdAt ? formatDate(new Date(item.createdAt)) : ''}</Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.acceptButton} onPress={() => handleFollowCircleRequest(item.circleId, item.id)}>
            <Text style={styles.acceptButtonText}>Follow</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.denyButton} onPress={() => handleDenyFollowCircleRequest(item.id)}>
            <Text style={styles.denyButtonText}>Deny</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )

  const renderInterestDiscovery = ({ item }: { item: InterestDiscoveryNotification }) => (
    <View style={styles.notificationItem}>
      <View style={[styles.avatarContainer, styles.interestIconContainer]}>
        <View style={styles.interestIcon}>
          <Ionicons name="sparkles" size={20} color={theme.colors.accent} />
        </View>
      </View>
      <View style={styles.notificationContent}>
        <View style={styles.notificationText}>
          <Text style={styles.userName}>
            {item.friendCount > 1
              ? `${item.friendCount} friends are posting about `
              : `${item.fromName} started posting about `}
          </Text>
          <Text style={styles.boldText}>#{item.interestDisplayName}</Text>
        </View>
        <Text style={styles.timeText}>{item.createdAt ? formatDate(new Date(item.createdAt)) : ''}</Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.acceptButton} onPress={() => handleFollowInterest(item.interestName)}>
            <Text style={styles.acceptButtonText}>Follow</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )

  if (isLoading) return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.placeholder} />
      </View>
      <View style={styles.loadingContainer}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
    </SafeAreaView>
  );

  if (error) return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.placeholder} />
      </View>
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadNotificationFeed}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.placeholder} />
      </View>
      {sortedFriendRequests.length + sortedNotifications.length > 0 ? (
          <View style={{ flex: 1 }}>
            {/* <FlatList data={sortedFriendRequests} renderItem={renderFriendRequest} keyExtractor={i => i.id} style={styles.list} showsVerticalScrollIndicator={false} /> */}
            <FlatList data={sortedCombinedFeed} renderItem={renderNotifications} keyExtractor={i => i.id} style={styles.list} showsVerticalScrollIndicator={false} />
          </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-outline" size={64} color={theme.colors.separator} />
            <Text style={styles.emptyText}>No notifications yet</Text>
            <Text style={styles.emptySubText}>You'll see friend requests and other notifications here when they arrive.</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const useStyles = makeStyles((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.backgroundAlt },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.separator, backgroundColor: theme.colors.card },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center', color: theme.colors.textPrimary },
  placeholder: { width: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  errorText: { fontSize: 16, color: theme.colors.danger, textAlign: 'center', marginBottom: 20 },
  retryButton: { paddingVertical: 10, paddingHorizontal: 20, backgroundColor: theme.colors.primary, borderRadius: 20 },
  retryButtonText: { color: theme.colors.primaryContrast, fontWeight: 'bold' },
  list: { flex: 1 },
  notificationItem: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.separator, alignItems: 'flex-start', backgroundColor: theme.colors.card },
  avatarContainer: { marginRight: 12 },
  notificationContent: { flex: 1 },
  notificationText: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 },
  userName: { fontWeight: 'bold', fontSize: 16, color: theme.colors.primary },
  actionText: { fontSize: 16, color: theme.colors.textPrimary },
  boldText: { fontSize: 16,  fontWeight: 'bold', color: theme.colors.textPrimary },
  timeText: { fontSize: 14, color: theme.colors.textMuted, marginBottom: 12 },
  actionButtons: { flexDirection: 'row', gap: 12 },
  acceptButton: { backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, minWidth: 70, alignItems: 'center' },
  acceptButtonText: { color: theme.colors.primaryContrast, fontWeight: 'bold', fontSize: 14 },
  denyButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, minWidth: 70, alignItems: 'center' },
  denyButtonText: { color: theme.colors.primary, fontWeight: 'bold', fontSize: 14 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { fontSize: 18, fontWeight: '600', color: theme.colors.textPrimary, marginTop: 16, marginBottom: 8 },
  emptySubText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  interestIconContainer: { justifyContent: 'center', alignItems: 'center' },
  interestIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.accent + '20', justifyContent: 'center', alignItems: 'center' },
}));

export default NotificationsScreen;