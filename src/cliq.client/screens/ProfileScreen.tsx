import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    SafeAreaView,
    Modal,
    Pressable
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Avatar } from '@rneui/base';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Ellipse, Path, Circle } from 'react-native-svg';
import { ApiClient } from 'services/apiClient';
import { FriendshipDto, FriendshipStatus, FriendshipStatusDto, PostDto, ProfilePageResponseDto, UserDto, UserProfileDto, VisibleStatus } from 'services/generated/generatedClient';
import Post from '../components/Post';
import { useAuth } from 'contexts/AuthContext';
import { handleShareProfile } from 'utils/share';
import NotificationBell from 'components/NotificationBell';
import Header from 'components/Header';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';

// Easter egg snowman growth rate
const PIXELS_PER_EGG = 2;

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
    statsContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 24, marginBottom: 24 },
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
    snowmanContainer: { 
        alignItems: 'center', 
        justifyContent: 'flex-end',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    tooltip: {
        backgroundColor: theme.colors.card,
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: theme.colors.primary
    },
    tooltipText: {
        color: theme.colors.textPrimary,
        fontSize: 14,
        fontWeight: '600'
    },
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
    const [easterEggCount, setEasterEggCount] = useState<number>(0);
    const [showEggTooltip, setShowEggTooltip] = useState(false);
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
            setEasterEggCount(profileData.easterEggCount || 0);
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

    // Refresh profile when screen comes into focus (e.g., after triggering easter egg)
    useFocusEffect(
        React.useCallback(() => {
            if (!isLoading) {
                fetchUserProfile();
            }
        }, [userId])
    );

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
                            
                            {/* Easter Egg - Hidden Snowman */}
                            {theme.name === 'holiday' && (
                                <Pressable 
                                    style={styles.statItem}
                                    onPress={() => setShowEggTooltip(true)}
                                >
                                    <View style={styles.snowmanContainer}>
                                        <Svg 
                                            width={50} 
                                            height={80 + (easterEggCount * PIXELS_PER_EGG)} 
                                            viewBox={`0 0 50 ${80 + (easterEggCount * PIXELS_PER_EGG)}`}
                                        >
                                            {/* Calculate hat height based on easter eggs */}
                                            {(() => {
                                                const baseHatHeight = 10;
                                                const hatHeight = baseHatHeight + (easterEggCount * PIXELS_PER_EGG);
                                                const svgHeight = 80 + (easterEggCount * PIXELS_PER_EGG);
                                                const hatTop = svgHeight - 60 - hatHeight;
                                                const hatBrim = svgHeight - 60;
                                                const headCenter = svgHeight - 52;
                                                const middleCenter = svgHeight - 35;
                                                const bottomCenter = svgHeight - 15;
                                                
                                                return (
                                                    <>
                                                        {/* Bottom snowball */}
                                                        <Ellipse 
                                                            cx={25} 
                                                            cy={bottomCenter} 
                                                            rx={14} 
                                                            ry={12} 
                                                            fill="#FFFFFF" 
                                                            stroke="#E0E0E0" 
                                                            strokeWidth={1.5} 
                                                        />
                                                        
                                                        {/* Middle snowball */}
                                                        <Ellipse 
                                                            cx={25} 
                                                            cy={middleCenter} 
                                                            rx={11} 
                                                            ry={9} 
                                                            fill="#FFFFFF" 
                                                            stroke="#E0E0E0" 
                                                            strokeWidth={1.5} 
                                                        />
                                                        
                                                        {/* Head */}
                                                        <Ellipse 
                                                            cx={25} 
                                                            cy={headCenter} 
                                                            rx={9} 
                                                            ry={8} 
                                                            fill="#FFFFFF" 
                                                            stroke="#E0E0E0" 
                                                            strokeWidth={1.5} 
                                                        />
                                                        
                                                        {/* Eyes */}
                                                        <Circle cx={22} cy={headCenter - 1} r={1.2} fill="#2C2C2C" />
                                                        <Circle cx={28} cy={headCenter - 1} r={1.2} fill="#2C2C2C" />
                                                        
                                                        {/* Carrot nose */}
                                                        <Path 
                                                            d={`M23.5 ${headCenter + 0.5} L28 ${headCenter + 1} L23.5 ${headCenter + 1.5} Z`}
                                                            fill="#FF6B35" 
                                                            stroke="#E55A2B" 
                                                            strokeWidth={0.3} 
                                                        />
                                                        
                                                        {/* Smile */}
                                                        <Path 
                                                            d={`M22 ${headCenter + 3.5} Q25 ${headCenter + 4.5} 28 ${headCenter + 3.5}`}
                                                            stroke="#2C2C2C" 
                                                            strokeWidth={1} 
                                                            fill="none" 
                                                            strokeLinecap="round"
                                                        />
                                                        
                                                        {/* Coal buttons on middle */}
                                                        <Circle cx={25} cy={middleCenter - 3} r={1} fill="#2C2C2C" />
                                                        <Circle cx={25} cy={middleCenter} r={1} fill="#2C2C2C" />
                                                        <Circle cx={25} cy={middleCenter + 3} r={1} fill="#2C2C2C" />
                                                        
                                                        {/* Growing Hat - height increases with easter eggs */}
                                                        {/* Hat brim */}
                                                        <Path 
                                                            d={`M16 ${hatBrim} L34 ${hatBrim} L34 ${hatBrim + 2} L16 ${hatBrim + 2} Z`} 
                                                            fill="#2C2C2C" 
                                                        />
                                                        {/* Hat top - grows taller */}
                                                        <Path 
                                                            d={`M20 ${hatTop} L30 ${hatTop} L30 ${hatBrim} L20 ${hatBrim} Z`} 
                                                            fill="#2C2C2C" 
                                                        />
                                                        {/* Hat band - moves with hat height */}
                                                        <Path 
                                                            d={`M20 ${hatBrim - 3} L30 ${hatBrim - 3} L30 ${hatBrim - 1.5} L20 ${hatBrim - 1.5} Z`} 
                                                            fill="#C41E3A" 
                                                        />
                                                    </>
                                                );
                                            })()}
                                        </Svg>
                                    </View>
                                </Pressable>
                            )}
                        </View>

                        {/* Tooltip Modal */}
                        <Modal
                            visible={showEggTooltip}
                            transparent
                            animationType="fade"
                            onRequestClose={() => setShowEggTooltip(false)}
                        >
                            <Pressable 
                                style={styles.modalOverlay}
                                onPress={() => setShowEggTooltip(false)}
                            >
                                <View style={styles.tooltip}>
                                    <Text style={styles.tooltipText}>
                                        🎉 Easter Eggs: {easterEggCount}
                                    </Text>
                                </View>
                            </Pressable>
                        </Modal>

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