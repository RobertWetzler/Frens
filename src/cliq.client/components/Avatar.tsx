import { StyleSheet, View, Text, TouchableWithoutFeedback, Animated } from 'react-native';
import { Avatar as RneuiAvatar } from '@rneui/base';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';
import { useRef, useState, useEffect } from 'react';

// Create animated SVG components
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedPath = Animated.createAnimatedComponent(Path);

interface AvatarProps {
    name: string;
    userId: string;
    imageUrl?: string;
    navigation?: any;
}

const useStyles = makeStyles((theme) => ({
    avatarContainer: {
        padding: 2,
        backgroundColor: theme.colors.card,
        borderRadius: 60,
        marginRight: 7,
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

export const Avatar: React.FC<AvatarProps> = ({ name, userId, imageUrl, navigation }) => {
    const { theme } = useTheme();
    const styles = useStyles();
    const initial = name?.charAt(0)?.toUpperCase() || '?';
    
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
        }
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

    if (theme.name === 'holiday') {
        return (
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
                            {/* Smile - coal dots */}
                            <Ellipse cx={14} cy={30} rx={1.5} ry={1.5} fill="#2C2C2C" />
                            <Ellipse cx={18} cy={32} rx={1.5} ry={1.5} fill="#2C2C2C" />
                            <Ellipse cx={22} cy={33} rx={1.5} ry={1.5} fill="#2C2C2C" />
                            <Ellipse cx={26} cy={32} rx={1.5} ry={1.5} fill="#2C2C2C" />
                            <Ellipse cx={30} cy={30} rx={1.5} ry={1.5} fill="#2C2C2C" />
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
                                top: 0,
                                left: 0,
                                right: 0,
                                transform: [{ scaleY: hatScaleAnim }],
                                transformOrigin: 'bottom center'
                            }}
                        >
                            <Svg width={44} height={44} viewBox="0 0 44 44">
                                {/* Top hat */}
                                <Path d="M12 10 L32 10 L32 12 L12 12 Z" fill="#2C2C2C" />
                                <Path d="M16 2 L28 2 L28 10 L16 10 Z" fill="#2C2C2C" />
                                {/* Hat band */}
                                <Path d="M16 7 L28 7 L28 9 L16 9 Z" fill="#C41E3A" />
                            </Svg>
                        </Animated.View>
                    </View>
                </Animated.View>
            </TouchableWithoutFeedback>
        );
    }

    return (
        <View style={styles.avatarContainer}>
            <RneuiAvatar
                rounded
                overlayContainerStyle={{ backgroundColor: theme.colors.primary }}
                title={initial}
            />
        </View>
    );
};

export default Avatar;


// styles generated via useStyles