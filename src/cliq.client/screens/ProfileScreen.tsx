import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    SafeAreaView
} from 'react-native';
import { Avatar } from '@rneui/base';
import { Ionicons } from '@expo/vector-icons';
import { ApiClient } from 'services/apiClient';
import { FriendshipDto, FriendshipStatus, FriendshipStatusDto, PostDto, ProfilePageResponseDto, UserDto, UserProfileDto, VisibleStatus } from 'services/generated/generatedClient';
import Post from '../components/Post';
import { useAuth } from 'contexts/AuthContext';
import { handleShareProfile } from 'utils/share';
import NotificationBell from 'components/NotificationBell';
import Header from 'components/Header';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';

// makeStyles at bottom
const useStyles = makeStyles((theme) => ({
    container: { flex: 1, backgroundColor: theme.colors.backgroundAlt },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.backgroundAlt },
    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.backgroundAlt, padding: 20 },
    errorText: { fontSize: 16, color: theme.colors.danger, textAlign: 'center', marginBottom: 20 },
    retryButton: { paddingVertical: 10, paddingHorizontal: 20, backgroundColor: theme.colors.primary, borderRadius: 20 },
    retryButtonText: { color: theme.colors.primaryContrast, fontWeight: 'bold' },
    headerActions: { flexDirection: 'row', alignItems: 'center' },
    iconButton: { padding: 8, marginRight: 4 },
    profileHeader: { padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.separator },
    avatarContainer: { marginBottom: 16 },
    userName: { fontSize: 24, fontWeight: 'bold', marginBottom: 8, color: theme.colors.textPrimary },
    userBio: { fontSize: 16, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 16, paddingHorizontal: 20 },
    statsContainer: { flexDirection: 'row', width: '100%', justifyContent: 'space-around', marginBottom: 24 },
    statItem: { alignItems: 'center' },
    statNumber: { fontSize: 18, fontWeight: 'bold', color: theme.colors.textPrimary },
    statLabel: { fontSize: 14, color: theme.colors.textMuted },
    followButton: { backgroundColor: theme.colors.primary, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 20, marginBottom: 20 },
    followButtonText: { color: theme.colors.primaryContrast, fontWeight: 'bold', fontSize: 16 },
    friendsButton: { backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.primary },
    friendsButtonText: { color: theme.colors.primary },
    pendingButton: { backgroundColor: theme.colors.card, borderWidth: 2, borderColor: theme.colors.primary, borderStyle: 'dashed' },
    pendingButtonText: { color: theme.colors.primary },
    blockedButton: { backgroundColor: theme.colors.textPrimary, borderWidth: 1, borderColor: theme.colors.card },
    blockedButtonText: { color: theme.colors.primaryContrast },
    acceptRequestButton: { backgroundColor: theme.colors.accent, borderWidth: 0 },
    acceptRequestButtonText: { color: theme.colors.primaryContrast, fontWeight: 'bold' },
    followingButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.primary },
    followingButtonText: { color: theme.colors.primary },
    sectionDivider: { height: 1, backgroundColor: theme.colors.separator, width: '100%', marginBottom: 16 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', alignSelf: 'flex-start', marginBottom: 12, color: theme.colors.textPrimary },
    emptyPostsContainer: { padding: 40, alignItems: 'center' },
    emptyPostsText: { marginTop: 16, fontSize: 16, color: theme.colors.textMuted, textAlign: 'center' },
}));

interface ProfileScreenProps {
    route?: { params?: { userId?: string } };
    navigation: any;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ route, navigation }) => {
    const { user: currentUser } = useAuth();
    const { theme } = useTheme();
    const styles = useStyles();
    // Get userId from route params or use current user's ID if not provided
    const userId = route?.params?.userId || currentUser?.id;
    // TODO understand why currentUser.id is undefined
    console.log("User ID:", userId);
    console.log("Current User:", currentUser);
    const [user, setUser] = useState<UserProfileDto | null>(null);
    const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatusDto | null>(null);
    const [posts, setPosts] = useState<PostDto[]>([]);
    const [notificationCount, setNotificationCount] = useState<number>();
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchUserProfile = async () => {
        try {
            // Fetch user profile data
            const profileData = await ApiClient.call(c => c.profile_GetProfile(userId));
            setUser(profileData.profile);
            if (currentUser?.id !== userId) {
                setFriendshipStatus(profileData.friendshipStatus);
            }
            setPosts(profileData.recentPosts);
            setNotificationCount(profileData.notificationCount);
            setError(null);
        }
        catch (err) {
            console.error("Error fetching profile data:", err);
            setError("Failed to load profile data. Please try again.");
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchUserProfile();
    }, [userId]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchUserProfile();
    };

    const toggleFollow = async () => {
        try {
            if (friendshipStatus.status == VisibleStatus.Friends) {
                await ApiClient.call(c => c.frenship_RemoveFriend(userId));
                setFriendshipStatus(new FriendshipStatusDto({
                    ...friendshipStatus,
                    status: VisibleStatus.None
                }));
            } 
            else if (friendshipStatus.status == VisibleStatus.PendingSent) {
                await ApiClient.call(c => c.frenship_CancelFriendRequest(friendshipStatus.friendshipId));
                setFriendshipStatus(new FriendshipStatusDto({
                    ...friendshipStatus,
                    status: VisibleStatus.None
                }));            } else {
                const res = await ApiClient.call(c => c.frenship_SendFriendRequest(userId));
                // TODO backend should return a VisibleStatus here
                const statusMap = {
                    [FriendshipStatus.Accepted]: VisibleStatus.Friends,
                    [FriendshipStatus.Blocked]: VisibleStatus.Blocked,
                    [FriendshipStatus.Rejected]: VisibleStatus.None
                };
                const status = statusMap[res.status] || VisibleStatus.PendingSent;
                setFriendshipStatus(new FriendshipStatusDto({
                    friendshipId: res.id,
                    status: status
                }));
            }
        } catch (err) {
            console.error("Error updating follow status:", err);
        }
    };

    const isOwnProfile = currentUser?.id === userId;

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={fetchUserProfile}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Header
                title={isOwnProfile ? 'My Profile' : 'Profile'}
                onBackPress={!isOwnProfile ? () => navigation.goBack() : undefined}
                showBackButton={!isOwnProfile}
                titleAlign="left"
                rightActions={
                    <View style={styles.headerActions}>
                        <TouchableOpacity 
                            style={styles.iconButton} 
                            onPress={() => handleShareProfile(userId)}
                        >
                            <Ionicons name="share-outline" size={24} color={theme.colors.primary} />
                        </TouchableOpacity>
                        {isOwnProfile && (
                            <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Settings')}>
                                <Ionicons name="settings-outline" size={24} color={theme.colors.primary} />
                            </TouchableOpacity>
                        )}
                        <NotificationBell onPress={() => navigation.navigate('Notifications')} notificationCount={notificationCount} />
                    </View>
                }
            />

            <FlatList
                ListHeaderComponent={
                    <View style={styles.profileHeader}>
                        <View style={styles.avatarContainer}>
                            <Avatar
                                rounded
                                size="xlarge"
                                overlayContainerStyle={{ backgroundColor: theme.colors.primary }}
                                title={user?.name?.charAt(0).toUpperCase() || '?'}
                            />
                        </View>

                        <Text style={styles.userName}>{user?.name || 'User'}</Text>
                        <Text style={styles.userBio}>{user?.bio || ''}</Text>

                        <View style={styles.statsContainer}>
                            <View style={styles.statItem}>
                                <Text style={styles.statNumber}>{posts.length}</Text>
                                <Text style={styles.statLabel}>Posts</Text>
                            </View>
                        </View>

                        {!isOwnProfile && (
                            <TouchableOpacity
                                style={[
                                    styles.followButton,
                                    friendshipStatus.status == VisibleStatus.Friends ? styles.friendsButton : 
                                    friendshipStatus.status == VisibleStatus.PendingSent ? styles.pendingButton :
                                    friendshipStatus.status == VisibleStatus.Blocked ? styles.blockedButton :
                                    friendshipStatus.status == VisibleStatus.PendingReceived ? styles.acceptRequestButton : {}
                                ]}
                                onPress={toggleFollow}
                            >
                                <Text style={[
                                    styles.followButtonText,
                                    friendshipStatus.status == VisibleStatus.Friends ? styles.friendsButtonText : 
                                    friendshipStatus.status == VisibleStatus.PendingSent ? styles.pendingButtonText :
                                    friendshipStatus.status == VisibleStatus.Blocked ? styles.blockedButtonText :
                                    friendshipStatus.status == VisibleStatus.PendingReceived ? styles.acceptRequestButtonText : {}
                                ]}>
                                    {friendshipStatus.status == VisibleStatus.Friends ? 'Frens!':
                                    friendshipStatus.status == VisibleStatus.PendingSent ? 'Request Sent':
                                    friendshipStatus.status == VisibleStatus.Blocked ? 'Blocked':
                                    friendshipStatus.status == VisibleStatus.PendingReceived ? 'Accept Request':
                                    'Become Frens'}
                                </Text>
                            </TouchableOpacity>
                        )}

                        <View style={styles.sectionDivider} />
                        <Text style={styles.sectionTitle}>Recent Posts</Text>
                    </View>
                }
                data={posts}
                renderItem={({ item }) => (
                    <Post post={item} isNavigable={true} navigation={navigation}/>
                )}
                keyExtractor={item => item.id}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        colors={[theme.colors.primary]}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyPostsContainer}>
                        <Ionicons name="document-text-outline" size={48} color={theme.colors.separator} />
                        <Text style={styles.emptyPostsText}>
                            {isOwnProfile
                                ? "You haven't posted anything yet"
                                : "This user hasn't posted anything yet"}
                        </Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
};
// (styles removed; replaced by useStyles above)
export default ProfileScreen;