import React, { useRef, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InterestSuggestionDto, FollowInterestRequest } from 'services/generated/generatedClient';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';
import { ApiClient } from 'services/apiClient';

interface SuggestedInterestsCardProps {
    interests: InterestSuggestionDto[];
    shouldAnimate?: boolean;
    animationDelay?: number;
    onInterestFollowed?: (interestName: string) => void;
}

const SuggestedInterestsCard: React.FC<SuggestedInterestsCardProps> = ({
    interests,
    shouldAnimate = false,
    animationDelay = 0,
    onInterestFollowed
}) => {
    const { theme } = useTheme();
    const styles = useStyles();
    const translateY = useRef(new Animated.Value(shouldAnimate ? 100 : 0)).current;
    const opacity = useRef(new Animated.Value(shouldAnimate ? 0 : 1)).current;
    const scale = useRef(new Animated.Value(shouldAnimate ? 0.8 : 1)).current;
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

    // Filter out already followed interests
    const visibleInterests = interests.filter(i => !followedInterestNames.has(i.name!));

    if (visibleInterests.length === 0) {
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
            <View style={styles.header}>
                <Ionicons name="sparkles-outline" size={22} color={theme.colors.primary} />
                <Text style={styles.headerText}>Interests Your Friends Post To</Text>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {visibleInterests.map((interest) => (
                    <View key={interest.id} style={styles.interestItem}>
                        <View style={styles.interestInfo}>
                            <View style={styles.hashtagBadge}>
                                <Text style={styles.hashtagText}>#</Text>
                            </View>
                            <View style={styles.interestTextContainer}>
                                <Text style={styles.interestName} numberOfLines={1}>
                                    {interest.displayName}
                                </Text>
                                <Text style={styles.friendsCount} numberOfLines={1}>
                                    {interest.friendsUsingCount} {interest.friendsUsingCount === 1 ? 'friend posts' : 'friends post'}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={[
                                styles.followButton,
                                followingInterestName === interest.name && styles.followButtonDisabled
                            ]}
                            onPress={() => handleFollow(interest)}
                            disabled={followingInterestName === interest.name}
                        >
                            {followingInterestName === interest.name ? (
                                <ActivityIndicator size="small" color={theme.colors.primaryContrast} />
                            ) : (
                                <>
                                    <Ionicons name="add" size={16} color={theme.colors.primaryContrast} />
                                    <Text style={styles.followButtonText}>Follow</Text>
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
    interestItem: {
        backgroundColor: theme.colors.backgroundAlt,
        borderRadius: 12,
        padding: 12,
        marginRight: 12,
        minWidth: 170,
        maxWidth: 210,
    },
    interestInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    hashtagBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: theme.colors.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
    },
    hashtagText: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.colors.primary,
    },
    interestTextContainer: {
        flex: 1,
        marginLeft: 8,
    },
    interestName: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.textPrimary,
    },
    friendsCount: {
        fontSize: 12,
        color: theme.colors.textMuted,
        marginTop: 2,
    },
    followButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.primary,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    followButtonDisabled: {
        opacity: 0.7,
    },
    followButtonText: {
        color: theme.colors.primaryContrast,
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 4,
    },
}));

export default SuggestedInterestsCard;
