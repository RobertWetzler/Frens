import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    SafeAreaView
} from 'react-native';
import { Avatar } from '@rneui/base';
import { Ionicons } from '@expo/vector-icons';
import { ApiClient } from 'services/apiClient';
import { FriendshipStatus, PostDto, ProfilePageResponseDto, UserDto, UserProfileDto, VisibleStatus } from 'services/generated/generatedClient';
import Post from '../components/Post';
import { useAuth } from 'contexts/AuthContext';

interface ProfileScreenProps {
    route?: { params?: { userId?: string } };
    navigation: any;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ route, navigation }) => {
    const { user: currentUser } = useAuth();
    // Get userId from route params or use current user's ID if not provided
    const userId = route?.params?.userId || currentUser?.id;
    // TODO understand why currentUser.id is undefined
    console.log("User ID:", userId);
    console.log("Current User:", currentUser);
    const [user, setUser] = useState<UserProfileDto | null>(null);
    const [posts, setPosts] = useState<PostDto[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [followStatus, setFollowStatus] = useState<VisibleStatus>(VisibleStatus.None);
    const [error, setError] = useState<string | null>(null);

    const fetchUserProfile = async () => {
        try {
            // Fetch user profile data
            const profileData = await ApiClient.call(c => c.profile(userId));
            setUser(profileData.profile);

            if (currentUser?.id !== userId) {
                setFollowStatus(profileData.friendshipStatus.status);
            }
            setPosts(profileData.recentPosts);
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
            if (followStatus == VisibleStatus.Friends) {
                await ApiClient.call(c => c.removeFriend(userId));
                setFollowStatus(VisibleStatus.None);
            } else {
                const res = await ApiClient.call(c => c.sendRequest(userId));
                const statusMap = {
                    [FriendshipStatus.Accepted]: VisibleStatus.Friends,
                    [FriendshipStatus.Blocked]: VisibleStatus.Blocked,
                    [FriendshipStatus.Rejected]: VisibleStatus.None
                };
                const status = statusMap[res.status] || VisibleStatus.PendingSent;
                setFollowStatus(status);
            }
        } catch (err) {
            console.error("Error updating follow status:", err);
        }
    };

    const isOwnProfile = currentUser?.id === userId;

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1DA1F2" />
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
            <View style={styles.header}>
                {!isOwnProfile && (
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#1DA1F2" />
                    </TouchableOpacity>
                )}
                <Text style={styles.headerTitle}>
                    {isOwnProfile ? 'My Profile' : 'Profile'}
                </Text>
                {isOwnProfile && (
                    <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate('EditProfile')}>
                        <Ionicons name="settings-outline" size={24} color="#1DA1F2" />
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                ListHeaderComponent={
                    <View style={styles.profileHeader}>
                        <View style={styles.avatarContainer}>
                            <Avatar
                                rounded
                                size="xlarge"
                                overlayContainerStyle={{ backgroundColor: '#73cbff' }}
                                title={user?.name?.charAt(0).toUpperCase() || '?'}
                            // Uncomment when user images are available
                            // source={{ uri: user?.imageUrl }}
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
                                    followStatus == VisibleStatus.Friends ? styles.followingButton : {}
                                ]}
                                onPress={toggleFollow}
                            >
                                <Text style={[
                                    styles.followButtonText,
                                    followStatus == VisibleStatus.Friends ? styles.followingButtonText : {}
                                ]}>
                                    {followStatus == VisibleStatus.Friends ? 'Frens':
                                    followStatus == VisibleStatus.PendingSent ? 'Request Sent':
                                    followStatus == VisibleStatus.Blocked ? 'Blocked':
                                    followStatus == VisibleStatus.PendingReceived ? 'Accept Request':
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
                        colors={["#1DA1F2"]}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyPostsContainer}>
                        <Ionicons name="document-text-outline" size={48} color="#ccc" />
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 20,
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
    editButton: {
        padding: 8,
    },
    profileHeader: {
        padding: 20,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#e1e4e8',
    },
    avatarContainer: {
        marginBottom: 16,
    },
    userName: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    userBio: {
        fontSize: 16,
        color: '#4a4a4a',
        textAlign: 'center',
        marginBottom: 16,
        paddingHorizontal: 20,
    },
    statsContainer: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-around',
        marginBottom: 24,
    },
    statItem: {
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    statLabel: {
        fontSize: 14,
        color: '#8e8e8e',
    },
    followButton: {
        backgroundColor: '#1DA1F2',
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 20,
        marginBottom: 20,
    },
    followingButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#1DA1F2',
    },
    followButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    followingButtonText: {
        color: '#1DA1F2',
    },
    sectionDivider: {
        height: 1,
        backgroundColor: '#e1e4e8',
        width: '100%',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        alignSelf: 'flex-start',
        marginBottom: 12,
    },
    emptyPostsContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyPostsText: {
        marginTop: 16,
        fontSize: 16,
        color: '#8e8e8e',
        textAlign: 'center',
    },
});

export default ProfileScreen;