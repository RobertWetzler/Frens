import { StyleSheet, View, Text, TouchableWithoutFeedback, Animated } from 'react-native';
import { Avatar as RneuiAvatar } from '@rneui/base';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';
import { useRef, useState, useEffect } from 'react';
import { ApiClient } from '../services/apiClient';
import { easterEggEvents, EASTER_EGG_DISCOVERED } from '../hooks/easterEggEvents';
import { DiscoverEasterEggRequest } from 'services/generated/generatedClient';
import InfoModal from './InfoModal';
import { CachedImage } from './CachedImage';

// Create animated SVG components
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedPath = Animated.createAnimatedComponent(Path);

interface AvatarProps {
    name: string;
    userId: string;
    imageUrl?: string;
    navigation?: any;
    discoveredEasterEggs?: { easterEggId?: string }[];
    /** When true, renders a minimal avatar without animations, easter eggs, or theming */
    simple?: boolean;
    /** Custom size in pixels (only applies when simple=true) */
    size?: number;
}

const useStyles = makeStyles((theme) => ({
    avatarContainer: {
        padding: 2,
        backgroundColor: theme.colors.card,
        borderRadius: 60,
        marginRight: 7,
    },
    cachedAvatarImage: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    pumpkinWrapper: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    initial: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        fontSize: 18,
        lineHeight: 44, // ensure vertical centering in 44x44 box
        fontWeight: '700',
        color: theme.colors.primaryContrast,
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.35)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
        includeFontPadding: false,
    },
    // Additional style tokens could be added here
}));

export const Avatar: React.FC<AvatarProps> = ({ name, userId, imageUrl, navigation, discoveredEasterEggs, simple = false, size = 40 }) => {
    const { theme } = useTheme();
    const styles = useStyles();
    const initial = name?.charAt(0)?.toUpperCase() || '?';
    
    // Simple mode: minimal avatar without animations, easter eggs, or theming
    if (simple) {
        if (imageUrl) {
            const cacheKey = `profile:${userId}`;
            return (
                <View style={{ 
                    overflow: 'hidden',
                    width: size, 
                    height: size, 
                    borderRadius: size / 2 
                }}>
                    <CachedImage
                        cacheKey={cacheKey}
                        signedUrl={imageUrl}
                        style={{ 
                            width: size, 
                            height: size, 
                            borderRadius: size / 2,
                            resizeMode: 'cover' as any,
                        }}
                        cacheTtlMs={24 * 60 * 60 * 1000}
                        showWhileFetching="none"
                    />
                </View>
            );
        }
        
        // Fallback to initial
        return (
            <View
                style={{
                    overflow: 'hidden',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: theme.colors.accent,
                }}
            >
                <Text
                    style={{
                        fontSize: size * 0.45,
                        fontWeight: '700',
                        textAlign: 'center',
                        color: theme.colors.primaryContrast,
                    }}
                >
                    {initial}
                </Text>
            </View>
        );
    }
    
    // If user has a profile picture, show it with caching (reduces S3 usage)
    if (imageUrl) {
        // Use userId as cache key for profile pictures (stable identifier)
        const cacheKey = `profile:${userId}`;
        
        return (
            <View style={styles.avatarContainer}>
                <CachedImage
                    cacheKey={cacheKey}
                    signedUrl={imageUrl}
                    style={styles.cachedAvatarImage}
                    cacheTtlMs={24 * 60 * 60 * 1000} // Cache for 24 hours
                    showWhileFetching="none"
                />
            </View>
        );
    }
    
    // Check if user has discovered the snowman_dance easter egg
    const hasSnowmanDanceEasterEgg = discoveredEasterEggs?.some(
        egg => egg.easterEggId === 'snowman_dance'
    ) ?? false;
    
    // Check if user is Spencer (ginger hair and beard easter egg)
    const isSpencer = name?.toLowerCase().includes('spencer') ?? false;
    
    // Check if user is Carlyn (long blonde hair and big smile)
    const isCarlyn = name?.toLowerCase().includes('carlyn') ?? false;
    
    // Easter egg: Triple-tap animation state
    const spinAnim = useRef(new Animated.Value(0)).current;
    const hatScaleAnim = useRef(new Animated.Value(1)).current;
    const winkAnim = useRef(new Animated.Value(1)).current; // 1 = open, 0 = closed
    const kissOpacity = useRef(new Animated.Value(0)).current;
    const kissX = useRef(new Animated.Value(0)).current;
    const kissY = useRef(new Animated.Value(0)).current;
    const kissScale = useRef(new Animated.Value(0.5)).current;
    const [tapCount, setTapCount] = useState(0);
    const tapTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [showEasterEggModal, setShowEasterEggModal] = useState(false);

    const handleTripleTap = () => {
        const newCount = tapCount + 1;
        setTapCount(newCount);

        // Clear existing timer
        if (tapTimerRef.current) {
            clearTimeout(tapTimerRef.current);
        }

        // Reset tap count after 500ms
        tapTimerRef.current = setTimeout(() => {
            setTapCount(0);
        }, 500);

        // Trigger animation on third tap
        if (newCount === 3) {
            setTapCount(0); // Reset immediately
            animateFrosty();
            recordEasterEgg();
        }
    };

    const recordEasterEgg = async () => {
        // Don't show modal if user already has this easter egg
        // if (hasSnowmanDanceEasterEgg) {
        //     return;
        // }
        
        try {
            const result = await ApiClient.call(c => c.easterEgg_DiscoverEasterEgg(new DiscoverEasterEggRequest({
                easterEggId: 'snowman_dance'
            })));
            // Show modal for new discovery after animation completes (~1.5s)
            if (result) {
                setTimeout(() => {
                    setShowEasterEggModal(true);
                }, 1600);
            }
        } catch (error) {
            // Silently fail - easter egg discovery is non-critical
            if (__DEV__) {
                console.log('Failed to record easter egg:', error);
            }
        }
    };

    const handleEasterEggModalClose = () => {
        setShowEasterEggModal(false);
        easterEggEvents.emit(EASTER_EGG_DISCOVERED, 'snowman_dance');
    };

    const animateFrosty = () => {
        // Reset animations
        spinAnim.setValue(0);
        hatScaleAnim.setValue(1);
        winkAnim.setValue(1);
        kissOpacity.setValue(0);
        kissX.setValue(0);
        kissY.setValue(0);
        kissScale.setValue(0.5);

        // Spin animation (360 degrees)
        const spin = Animated.timing(spinAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
        });

        // Hat tip animation (scale up and down)
        const hatTip = Animated.sequence([
            Animated.timing(hatScaleAnim, {
                toValue: 1.3,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(hatScaleAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
        ]);

        // Wink animation (close and open left eye)
        const wink = Animated.sequence([
            Animated.delay(600), // Wait for spin to finish
            Animated.timing(winkAnim, {
                toValue: 0,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.delay(150),
            Animated.timing(winkAnim, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
            }),
        ]);

        // Blow kiss animation (heart appears and floats away)
        const blowKiss = Animated.sequence([
            Animated.delay(850), // Wait for spin + wink
            Animated.parallel([
                Animated.timing(kissOpacity, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(kissScale, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]),
            Animated.parallel([
                Animated.timing(kissX, {
                    toValue: 30,
                    duration: 600,
                    useNativeDriver: true,
                }),
                Animated.timing(kissY, {
                    toValue: -20,
                    duration: 600,
                    useNativeDriver: true,
                }),
                Animated.timing(kissOpacity, {
                    toValue: 0,
                    duration: 600,
                    useNativeDriver: true,
                }),
                Animated.timing(kissScale, {
                    toValue: 1.5,
                    duration: 600,
                    useNativeDriver: true,
                }),
            ]),
        ]);

        // Run animations in sequence/parallel
        Animated.parallel([
            spin,
            hatTip,
            wink,
            blowKiss,
        ]).start();
    };

    const spinInterpolate = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (tapTimerRef.current) {
                clearTimeout(tapTimerRef.current);
            }
        };
    }, []);

    if (theme.name === 'halloween') {
        return (
            <View style={styles.avatarContainer} accessibilityLabel={`Avatar ${initial}`}>
                <View style={styles.pumpkinWrapper}>
                    <Svg width={44} height={44} viewBox="0 0 44 44">
                        {/* Larger, more prominent stem with bright green color */}
                        <Path d="M21 3 c2 0 3 1 3 3 v7 h-4 V6 c0-1.5 0.8-3 1-3z" fill="#43d854" stroke="#1e7f31" strokeWidth={0.6} />
                        <Ellipse cx={22} cy={24} rx={14} ry={13} fill={theme.colors.primary} stroke="#e05d00" strokeWidth={2} />
                        <Ellipse cx={16} cy={24} rx={10} ry={12} fill={theme.colors.primary} opacity={0.9} />
                        <Ellipse cx={28} cy={24} rx={10} ry={12} fill={theme.colors.primary} opacity={0.9} />
                        <Path d="M22 11 v26" stroke="#ffb066" strokeWidth={1.2} strokeLinecap="round" opacity={0.6} />
                        <Path d="M18 12 v24" stroke="#ffb066" strokeWidth={0.9} strokeLinecap="round" opacity={0.45} />
                        <Path d="M26 12 v24" stroke="#ffb066" strokeWidth={0.9} strokeLinecap="round" opacity={0.45} />
                    </Svg>
                    <Text style={styles.initial}>{initial}</Text>
                </View>
            </View>
        );
    }

    if (theme.name === 'holiday' || isCarlyn || isSpencer) {
        return (
            <>
            <TouchableWithoutFeedback onPress={handleTripleTap}>
                <Animated.View 
                    style={[
                        styles.avatarContainer,
                        {
                            transform: [{ rotate: spinInterpolate }]
                        }
                    ]} 
                    accessibilityLabel={`Avatar ${initial}`}
                >
                    <View style={styles.pumpkinWrapper}>
                        <Svg width={44} height={44} viewBox="0 0 44 44">
                            {/* Snowman face */}
                            <Ellipse cx={22} cy={24} rx={16} ry={16} fill="#FFFFFF" stroke="#E0E0E0" strokeWidth={1.5} />
                            
                            {/* Spencer's ginger hair */}
                            {isSpencer && (
                                <>
                                    {/* Ginger hair on top - short textured strands */}
                                    <Path d="M10 16 Q11 10 14 12" stroke="#C94A1C" strokeWidth={2} fill="none" strokeLinecap="round" />
                                    <Path d="M13 14 Q14 8 17 10" stroke="#D4582A" strokeWidth={2} fill="none" strokeLinecap="round" />
                                    <Path d="M16 12 Q17 6 20 9" stroke="#C94A1C" strokeWidth={2.5} fill="none" strokeLinecap="round" />
                                    <Path d="M19 11 Q20 5 23 8" stroke="#B8421A" strokeWidth={2} fill="none" strokeLinecap="round" />
                                    <Path d="M22 10 Q23 5 26 8" stroke="#D4582A" strokeWidth={2.5} fill="none" strokeLinecap="round" />
                                    <Path d="M25 11 Q26 6 29 9" stroke="#C94A1C" strokeWidth={2} fill="none" strokeLinecap="round" />
                                    <Path d="M28 12 Q29 8 32 11" stroke="#B8421A" strokeWidth={2} fill="none" strokeLinecap="round" />
                                    <Path d="M31 14 Q32 10 34 13" stroke="#D4582A" strokeWidth={2} fill="none" strokeLinecap="round" />
                                </>
                            )}
                            
                            {/* Carlyn's long blonde hair */}
                            {isCarlyn && (
                                <>
                                    {/* Long flowing wavy blonde hair - left side */}
                                    <Path d="M8 12 Q4 18 6 26 Q4 32 3 40" stroke="#E8C266" strokeWidth={3} fill="none" strokeLinecap="round" />
                                    <Path d="M10 10 Q5 16 7 24 Q5 30 4 38" stroke="#F5D67A" strokeWidth={3} fill="none" strokeLinecap="round" />
                                    <Path d="M12 9 Q7 15 9 22 Q6 28 6 36" stroke="#D4B04A" strokeWidth={2.5} fill="none" strokeLinecap="round" />
                                    <Path d="M14 8 Q10 14 11 20 Q8 26 8 34" stroke="#E8C266" strokeWidth={2.5} fill="none" strokeLinecap="round" />
                                    {/* Top of head hair */}
                                    <Path d="M14 10 Q18 5 22 7" stroke="#F5D67A" strokeWidth={3} fill="none" strokeLinecap="round" />
                                    <Path d="M22 7 Q26 5 30 10" stroke="#E8C266" strokeWidth={3} fill="none" strokeLinecap="round" />
                                    {/* Right side flowing wavy hair */}
                                    <Path d="M30 8 Q34 14 33 20 Q36 26 36 34" stroke="#E8C266" strokeWidth={2.5} fill="none" strokeLinecap="round" />
                                    <Path d="M32 9 Q37 15 35 22 Q38 28 38 36" stroke="#D4B04A" strokeWidth={2.5} fill="none" strokeLinecap="round" />
                                    <Path d="M34 10 Q39 16 37 24 Q39 30 40 38" stroke="#F5D67A" strokeWidth={3} fill="none" strokeLinecap="round" />
                                    <Path d="M36 12 Q40 18 38 26 Q40 32 41 40" stroke="#E8C266" strokeWidth={3} fill="none" strokeLinecap="round" />
                                </>
                            )}
                            
                            {/* Left eye - open (visible when winkAnim = 1) */}
                            <AnimatedEllipse 
                                cx={16} 
                                cy={20} 
                                rx={2.5} 
                                ry={2.5} 
                                fill="#2C2C2C" 
                                opacity={winkAnim}
                            />
                            {/* Left eye - winking (visible when winkAnim = 0) */}
                            <AnimatedPath 
                                d="M 13 20 L 19 20" 
                                stroke="#2C2C2C" 
                                strokeWidth={1.5} 
                                strokeLinecap="round"
                                opacity={winkAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [1, 0],
                                })}
                            />
                            {/* Right eye - always open */}
                            <Ellipse cx={28} cy={20} rx={2.5} ry={2.5} fill="#2C2C2C" />
                            {/* Carrot nose */}
                            <Path d="M20 21 L28 24 L20 27 Z" fill="#FF6B35" stroke="#E55A2B" strokeWidth={0.5} />
                            
                            {/* Spencer's ginger beard */}
                            {isSpencer ? (
                                <>
                                    {/* Ginger beard - short textured strands */}
                                    <Path d="M12 28 Q11 32 12 35" stroke="#C94A1C" strokeWidth={1.5} fill="none" strokeLinecap="round" />
                                    <Path d="M14 29 Q13 34 14 37" stroke="#D4582A" strokeWidth={1.5} fill="none" strokeLinecap="round" />
                                    <Path d="M16 30 Q15 35 16 38" stroke="#B8421A" strokeWidth={1.5} fill="none" strokeLinecap="round" />
                                    <Path d="M18 31 Q17 36 18 39" stroke="#C94A1C" strokeWidth={1.5} fill="none" strokeLinecap="round" />
                                    <Path d="M20 31 Q19 37 20 40" stroke="#D4582A" strokeWidth={1.5} fill="none" strokeLinecap="round" />
                                    <Path d="M22 32 Q22 38 22 41" stroke="#C94A1C" strokeWidth={1.5} fill="none" strokeLinecap="round" />
                                    <Path d="M24 31 Q25 37 24 40" stroke="#B8421A" strokeWidth={1.5} fill="none" strokeLinecap="round" />
                                    <Path d="M26 31 Q27 36 26 39" stroke="#D4582A" strokeWidth={1.5} fill="none" strokeLinecap="round" />
                                    <Path d="M28 30 Q29 35 28 38" stroke="#C94A1C" strokeWidth={1.5} fill="none" strokeLinecap="round" />
                                    <Path d="M30 29 Q31 34 30 37" stroke="#B8421A" strokeWidth={1.5} fill="none" strokeLinecap="round" />
                                    <Path d="M32 28 Q33 32 32 35" stroke="#D4582A" strokeWidth={1.5} fill="none" strokeLinecap="round" />
                                    {/* Mustache */}
                                    <Path d="M15 28 Q18 30 22 28 Q26 30 29 28" stroke="#B8421A" strokeWidth={2} fill="none" strokeLinecap="round" />
                                </>
                            ) : isCarlyn ? (
                                <>
                                    {/* Big :D smile for Carlyn - open mouth with teeth */}
                                    <Path d="M14 28 Q22 44 30 28" stroke="#2C2C2C" strokeWidth={1.5} fill="none" strokeLinecap="round" />
                                    <Path d="M14 28 L30 28" stroke="#2C2C2C" strokeWidth={1.5} strokeLinecap="round" />
                                </>
                            ) : (
                                <>
                                    {/* Normal smile - coal dots */}
                                    <Ellipse cx={14} cy={30} rx={1.5} ry={1.5} fill="#2C2C2C" />
                                    <Ellipse cx={18} cy={32} rx={1.5} ry={1.5} fill="#2C2C2C" />
                                    <Ellipse cx={22} cy={33} rx={1.5} ry={1.5} fill="#2C2C2C" />
                                    <Ellipse cx={26} cy={32} rx={1.5} ry={1.5} fill="#2C2C2C" />
                                    <Ellipse cx={30} cy={30} rx={1.5} ry={1.5} fill="#2C2C2C" />
                                </>
                            )}
                        </Svg>
                        {/* Animated kiss (heart) */}
                        <Animated.View 
                            style={{
                                position: 'absolute',
                                top: 24,
                                left: 22,
                                opacity: kissOpacity,
                                transform: [
                                    { translateX: kissX },
                                    { translateY: kissY },
                                    { scale: kissScale }
                                ]
                            }}
                        >
                            <Text style={{ fontSize: 16 }}>💋</Text>
                        </Animated.View>
                        {/* Hat in separate animated view for independent scaling */}
                        <Animated.View 
                            style={{
                                position: 'absolute',
                                top: hasSnowmanDanceEasterEgg ? -30 : 0,
                                left: 0,
                                right: 0,
                                transform: [{ scaleY: hatScaleAnim }],
                                transformOrigin: 'bottom center'
                            }}
                        >
                            <Svg 
                                width={44} 
                                height={hasSnowmanDanceEasterEgg ? 74 : 44} 
                                viewBox={hasSnowmanDanceEasterEgg ? "0 -30 44 74" : "0 0 44 44"}
                            >
                                {/* Top hat - extra tall if user discovered snowman_dance easter egg */}
                                {/* Brim */}
                                <Path d="M12 10 L32 10 L32 12 L12 12 Z" fill="#2C2C2C" />
                                {/* Hat body: normal is 8 units tall (2 to 10), easter egg is 40 units tall (-30 to 10) */}
                                <Path d={hasSnowmanDanceEasterEgg ? "M16 -15 L28 -15 L28 10 L16 10 Z" : "M16 2 L28 2 L28 10 L16 10 Z"} fill="#2C2C2C" />
                                {/* Hat band - positioned just above brim */}
                                <Path d="M16 7 L28 7 L28 9 L16 9 Z" fill="#C41E3A" />
                            </Svg>
                        </Animated.View>
                    </View>
                </Animated.View>
            </TouchableWithoutFeedback>
            <InfoModal
                visible={showEasterEggModal}
                title="🎉 Easter Egg Found!"
                message="You discovered the dancing snowman easter egg! You've earned a special flair ❄️ and a tall hat"
                buttonLabel="Awesome!"
                onClose={handleEasterEggModalClose}
                icon="snow"
            />
            </>
        );
    }

    return (
        <View style={styles.avatarContainer}>
            <RneuiAvatar
                rounded
                overlayContainerStyle={{ backgroundColor: theme.colors.primary }}
                title={initial}
                source={imageUrl ? { uri: imageUrl } : undefined}
            />
        </View>
    );
};

export default Avatar;


// styles generated via useStyles