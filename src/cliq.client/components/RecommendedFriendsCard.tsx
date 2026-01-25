import React, { useRef, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RecommendedFriendDto, FriendshipStatus } from 'services/generated/generatedClient';
import { Avatar } from './Avatar';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';
import { ApiClient } from 'services/apiClient';
import { useNavigation } from '@react-navigation/native';

interface RecommendedFriendsCardProps {
    friends: RecommendedFriendDto[];
    shouldAnimate?: boolean;
    animationDelay?: number;
    onFriendRequestSent?: (userId: string) => void;
}

const RecommendedFriendsCard: React.FC<RecommendedFriendsCardProps> = ({
    friends,
    shouldAnimate = false,
    animationDelay = 0,
    onFriendRequestSent
}) => {
    const { theme } = useTheme();
    const styles = useStyles();
    const navigation = useNavigation<any>();
    const translateY = useRef(new Animated.Value(shouldAnimate ? 100 : 0)).current;
    const opacity = useRef(new Animated.Value(shouldAnimate ? 0 : 1)).current;
    const scale = useRef(new Animated.Value(shouldAnimate ? 0.8 : 1)).current;
    const [sendingRequestUserId, setSendingRequestUserId] = useState<string | null>(null);
    const [sentRequestUserIds, setSentRequestUserIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (shouldAnimate) {
            const timer = setTimeout(() => {
                Animated.parallel([
                    Animated.spring(translateY, {
                        toValue: 0,
                        tension: 50,
                        friction: 8,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacity, {
                        toValue: 1,
                        duration: 400,
                        useNativeDriver: true,
                    }),
                    Animated.spring(scale, {
                        toValue: 1,
                        tension: 50,
                        friction: 8,
                        useNativeDriver: true,
                    }),
                ]).start();
            }, animationDelay);
            return () => clearTimeout(timer);
        }
    }, [shouldAnimate, animationDelay, translateY, opacity, scale]);

    const handleSendRequest = async (userId: string) => {
        if (sendingRequestUserId || sentRequestUserIds.has(userId)) return;
        
        setSendingRequestUserId(userId);
        try {
            const result = await ApiClient.call(c => c.frenship_SendFriendRequest(userId));
            // Check if request was sent successfully (Pending status) or auto-accepted (Accepted)
            if (result.status === FriendshipStatus.Pending || result.status === FriendshipStatus.Accepted) {
                setSentRequestUserIds(prev => new Set([...prev, userId]));
                onFriendRequestSent?.(userId);
            }
        } catch (error) {
            console.error('Failed to send friend request:', error);
        } finally {
            setSendingRequestUserId(null);
        }
    };

    const handleNavigateToProfile = (userId: string) => {
        navigation.navigate('Profile', { userId });
    };

    // Filter out users we've already sent requests to
    const visibleFriends = friends.filter(f => !sentRequestUserIds.has(f.user?.id!));
    
    if (visibleFriends.length === 0) {
        return null;
    }

    const getMutualFriendText = (count: number) => {
        if (count === 1) return '1 mutual friend';
        return `${count} mutual friends`;
    };

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    opacity,
                    transform: [{ translateY }, { scale }],
                },
            ]}
        >
            <View style={styles.header}>
                <Ionicons name="people-outline" size={22} color={theme.colors.primary} />
                <Text style={styles.headerText}>Frens of frens</Text>
            </View>
            
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {visibleFriends.map((friend) => (
                    <View key={friend.user?.id} style={styles.friendItem}>
                        <TouchableOpacity 
                            style={styles.friendInfo}
                            onPress={() => handleNavigateToProfile(friend.user?.id!)}
                            activeOpacity={0.7}
                        >
                            <Avatar
                                name={friend.user?.name || '?'}
                                userId={friend.user?.id || ''}
                                imageUrl={friend.user?.profilePictureUrl || undefined}
                                simple
                                size={72}
                            />
                            <Text style={styles.friendName} numberOfLines={1}>
                                {friend.user?.name}
                            </Text>
                            <Text style={styles.mutualCount} numberOfLines={1}>
                                {getMutualFriendText(friend.mutualFriendCount || 0)}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.addButton,
                                sendingRequestUserId === friend.user?.id && styles.addButtonDisabled
                            ]}
                            onPress={() => handleSendRequest(friend.user?.id!)}
                            disabled={sendingRequestUserId === friend.user?.id}
                        >
                            {sendingRequestUserId === friend.user?.id ? (
                                <ActivityIndicator size="small" color={theme.colors.primaryContrast} />
                            ) : (
                                <>
                                    <Ionicons name="person-add" size={16} color={theme.colors.primaryContrast} />
                                    <Text style={styles.addButtonText}>Add</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                ))}
            </ScrollView>
        </Animated.View>
    );
};

const useStyles = makeStyles((theme) => ({
    container: {
        backgroundColor: theme.colors.card,
        borderRadius: 12,
        marginHorizontal: 12,
        marginVertical: 6,
        padding: 15,
        paddingHorizontal: 10,
        shadowColor: theme.colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.textPrimary,
        marginLeft: 8,
    },
    scrollContent: {
        paddingRight: 8,
    },
    friendItem: {
        backgroundColor: theme.colors.backgroundAlt,
        borderRadius: 12,
        padding: 12,
        marginRight: 12,
        minWidth: 140,
        maxWidth: 160,
        alignItems: 'center',
    },
    friendInfo: {
        alignItems: 'center',
        marginBottom: 12,
    },
    friendName: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.textPrimary,
        marginTop: 10,
        textAlign: 'center',
    },
    mutualCount: {
        fontSize: 12,
        color: theme.colors.textMuted,
        marginTop: 4,
        textAlign: 'center',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.primary,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    addButtonDisabled: {
        opacity: 0.7,
    },
    addButtonText: {
        color: theme.colors.primaryContrast,
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 4,
    },
}));

export default RecommendedFriendsCard;
