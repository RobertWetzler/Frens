import React, { useRef, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SubscribableCircleDto, InterestSuggestionDto, FollowInterestRequest, FollowCircleRequest } from 'services/generated/generatedClient';
import { Avatar } from './Avatar';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';
import { ApiClient } from 'services/apiClient';

interface DiscoverCardProps {
    circles: SubscribableCircleDto[];
    interests: InterestSuggestionDto[];
    shouldAnimate?: boolean;
    animationDelay?: number;
    onCircleSubscribed?: (circleId: string) => void;
    onInterestFollowed?: (interestName: string) => void;
}

const DiscoverCard: React.FC<DiscoverCardProps> = ({
    circles,
    interests,
    shouldAnimate = false,
    animationDelay = 0,
    onCircleSubscribed,
    onInterestFollowed
}) => {
    const { theme } = useTheme();
    const styles = useStyles();
    const translateY = useRef(new Animated.Value(shouldAnimate ? 100 : 0)).current;
    const opacity = useRef(new Animated.Value(shouldAnimate ? 0 : 1)).current;
    const scale = useRef(new Animated.Value(shouldAnimate ? 0.8 : 1)).current;
    const [subscribingCircleId, setSubscribingCircleId] = useState<string | null>(null);
    const [subscribedCircleIds, setSubscribedCircleIds] = useState<Set<string>>(new Set());
    const [followingInterestName, setFollowingInterestName] = useState<string | null>(null);
    const [followedInterestNames, setFollowedInterestNames] = useState<Set<string>>(new Set());

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

    const handleSubscribe = async (circleId: string) => {
        if (subscribingCircleId || subscribedCircleIds.has(circleId)) return;
        setSubscribingCircleId(circleId);
        try {
            await ApiClient.call(c => c.circle_FollowCircle(new FollowCircleRequest({ circleId, notificationId: undefined })));
            setSubscribedCircleIds(prev => new Set([...prev, circleId]));
            onCircleSubscribed?.(circleId);
        } catch (error) {
            console.error('Failed to subscribe to circle:', error);
        } finally {
            setSubscribingCircleId(null);
        }
    };

    const handleFollow = async (interest: InterestSuggestionDto) => {
        if (followingInterestName || followedInterestNames.has(interest.name!)) return;
        setFollowingInterestName(interest.name!);
        try {
            const request = new FollowInterestRequest({ displayName: interest.displayName });
            await ApiClient.call(c => c.interest_FollowInterest(interest.name!, request));
            setFollowedInterestNames(prev => new Set([...prev, interest.name!]));
            onInterestFollowed?.(interest.name!);
        } catch (error) {
            console.error('Failed to follow interest:', error);
        } finally {
            setFollowingInterestName(null);
        }
    };

    const visibleCircles = circles.filter(c => !subscribedCircleIds.has(c.id!));
    const visibleInterests = interests.filter(i => !followedInterestNames.has(i.name!));

    if (visibleCircles.length === 0 && visibleInterests.length === 0) {
        return null;
    }

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
            {/* Card header */}
            <View style={styles.header}>
                <Ionicons name="compass-outline" size={22} color={theme.colors.primary} />
                <Text style={styles.headerText}>Discover</Text>
            </View>

            {/* Interests section */}
            {visibleInterests.length > 0 && (
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="sparkles" size={14} color={theme.colors.accent} />
                        <Text style={styles.sectionLabel}>Interests to follow</Text>
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        {visibleInterests.map((interest) => (
                            <View key={interest.id} style={styles.item}>
                                <View style={styles.itemInfo}>
                                    <View style={styles.hashtagBadge}>
                                        <Text style={styles.hashtagText}>#</Text>
                                    </View>
                                    <View style={styles.itemTextContainer}>
                                        <Text style={styles.itemName} numberOfLines={1}>
                                            {interest.displayName}
                                        </Text>
                                        <Text style={styles.itemSubtext} numberOfLines={1}>
                                            {interest.friendsUsingCount} {interest.friendsUsingCount === 1 ? 'friend is active' : 'friends are active'}
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={[
                                        styles.actionButton,
                                        followingInterestName === interest.name && styles.actionButtonDisabled
                                    ]}
                                    onPress={() => handleFollow(interest)}
                                    disabled={followingInterestName === interest.name}
                                >
                                    {followingInterestName === interest.name ? (
                                        <ActivityIndicator size="small" color={theme.colors.primaryContrast} />
                                    ) : (
                                        <>
                                            <Ionicons name="add" size={16} color={theme.colors.primaryContrast} />
                                            <Text style={styles.actionButtonText}>Follow</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Circles section */}
            {visibleCircles.length > 0 && (
                <View style={[styles.section, visibleInterests.length > 0 && styles.sectionDivider]}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="people" size={14} color={theme.colors.primary} />
                        <Text style={styles.sectionLabel}>Circles to join</Text>
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        {visibleCircles.map((circle) => (
                            <View key={circle.id} style={styles.item}>
                                <View style={styles.itemInfo}>
                                    <Avatar
                                        name={circle.owner?.name || '?'}
                                        userId={circle.owner?.id || ''}
                                        imageUrl={circle.owner?.profilePictureUrl || undefined}
                                        simple
                                        size={36}
                                    />
                                    <View style={styles.itemTextContainer}>
                                        <Text style={styles.itemName} numberOfLines={1}>
                                            {circle.name}
                                        </Text>
                                        <Text style={styles.itemSubtext} numberOfLines={1}>
                                            by {circle.owner?.name}
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={[
                                        styles.actionButton,
                                        subscribingCircleId === circle.id && styles.actionButtonDisabled
                                    ]}
                                    onPress={() => handleSubscribe(circle.id!)}
                                    disabled={subscribingCircleId === circle.id}
                                >
                                    {subscribingCircleId === circle.id ? (
                                        <ActivityIndicator size="small" color={theme.colors.primaryContrast} />
                                    ) : (
                                        <>
                                            <Ionicons name="add" size={16} color={theme.colors.primaryContrast} />
                                            <Text style={styles.actionButtonText}>Join</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            )}
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
        marginBottom: 14,
    },
    headerText: {
        fontSize: 17,
        fontWeight: '700',
        color: theme.colors.textPrimary,
        marginLeft: 8,
    },
    section: {
        marginBottom: 4,
    },
    sectionDivider: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: theme.colors.separator + '40',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        paddingHorizontal: 4,
        gap: 6,
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    scrollContent: {
        paddingRight: 8,
    },
    item: {
        backgroundColor: theme.colors.backgroundAlt,
        borderRadius: 12,
        padding: 12,
        marginRight: 12,
        minWidth: 175,
        maxWidth: 215,
    },
    itemInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    hashtagBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: theme.colors.accent + '20',
        justifyContent: 'center',
        alignItems: 'center',
    },
    hashtagText: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.colors.accent,
    },
    itemTextContainer: {
        flex: 1,
        marginLeft: 8,
    },
    itemName: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.textPrimary,
    },
    itemSubtext: {
        fontSize: 12,
        color: theme.colors.textMuted,
        marginTop: 2,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.primary,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    actionButtonDisabled: {
        opacity: 0.7,
    },
    actionButtonText: {
        color: theme.colors.primaryContrast,
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 4,
    },
}));

export default DiscoverCard;
