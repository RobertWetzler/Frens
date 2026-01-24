import React, { useRef, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SubscribableCircleDto } from 'services/generated/generatedClient';
import { Avatar } from './Avatar';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';
import { ApiClient } from 'services/apiClient';

interface SubscribableCirclesCardProps {
    circles: SubscribableCircleDto[];
    shouldAnimate?: boolean;
    animationDelay?: number;
    onCircleSubscribed?: (circleId: string) => void;
}

const SubscribableCirclesCard: React.FC<SubscribableCirclesCardProps> = ({
    circles,
    shouldAnimate = false,
    animationDelay = 0,
    onCircleSubscribed
}) => {
    const { theme } = useTheme();
    const styles = useStyles();
    const translateY = useRef(new Animated.Value(shouldAnimate ? 100 : 0)).current;
    const opacity = useRef(new Animated.Value(shouldAnimate ? 0 : 1)).current;
    const scale = useRef(new Animated.Value(shouldAnimate ? 0.8 : 1)).current;
    const [subscribingCircleId, setSubscribingCircleId] = useState<string | null>(null);
    const [subscribedCircleIds, setSubscribedCircleIds] = useState<Set<string>>(new Set());

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
            await ApiClient.call(c => c.circle_FollowCircle({ circleId, notificationId: undefined }));
            setSubscribedCircleIds(prev => new Set([...prev, circleId]));
            onCircleSubscribed?.(circleId);
        } catch (error) {
            console.error('Failed to subscribe to circle:', error);
        } finally {
            setSubscribingCircleId(null);
        }
    };

    // Filter out already subscribed circles
    const visibleCircles = circles.filter(c => !subscribedCircleIds.has(c.id!));
    
    if (visibleCircles.length === 0) {
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
                <Ionicons name="people-circle-outline" size={22} color={theme.colors.primary} />
                <Text style={styles.headerText}>Circles You Can Subscribe To</Text>
            </View>
            
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {visibleCircles.map((circle) => (
                    <View key={circle.id} style={styles.circleItem}>
                        <View style={styles.circleInfo}>
                            <Avatar
                                name={circle.owner?.name || '?'}
                                userId={circle.owner?.id || ''}
                                imageUrl={circle.owner?.profilePictureUrl || undefined}
                                simple
                                size={36}
                            />
                            <View style={styles.circleTextContainer}>
                                <Text style={styles.circleName} numberOfLines={1}>
                                    {circle.name}
                                </Text>
                                <Text style={styles.ownerName} numberOfLines={1}>
                                    by {circle.owner?.name}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={[
                                styles.subscribeButton,
                                subscribingCircleId === circle.id && styles.subscribeButtonDisabled
                            ]}
                            onPress={() => handleSubscribe(circle.id!)}
                            disabled={subscribingCircleId === circle.id}
                        >
                            {subscribingCircleId === circle.id ? (
                                <ActivityIndicator size="small" color={theme.colors.primaryContrast} />
                            ) : (
                                <>
                                    <Ionicons name="add" size={16} color={theme.colors.primaryContrast} />
                                    <Text style={styles.subscribeButtonText}>Join</Text>
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
    circleItem: {
        backgroundColor: theme.colors.backgroundAlt,
        borderRadius: 12,
        padding: 12,
        marginRight: 12,
        minWidth: 180,
        maxWidth: 220,
    },
    circleInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    circleTextContainer: {
        flex: 1,
        marginLeft: 8,
    },
    circleName: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.textPrimary,
    },
    ownerName: {
        fontSize: 12,
        color: theme.colors.textMuted,
        marginTop: 2,
    },
    subscribeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.primary,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    subscribeButtonDisabled: {
        opacity: 0.7,
    },
    subscribeButtonText: {
        color: theme.colors.primaryContrast,
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 4,
    },
}));

export default SubscribableCirclesCard;
