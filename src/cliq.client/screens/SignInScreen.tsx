import React, { useEffect, useRef } from 'react';
import { View, Text, StatusBar, Platform, Animated } from 'react-native';
import { useShaderBackground } from '../contexts/ShaderBackgroundContext';
import { EmailSignInButton } from 'components/EmailSignInButton';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';

interface SignInScreenProps {
  route?: { params?: { returnTo?: string } };
  navigation?: any;
}

export default function SignInScreen({ route, navigation }: SignInScreenProps) {
    const returnTo = route?.params?.returnTo;
    const { shaderRef, animateToExpanded, animateToCollapsed } = useShaderBackground();
    const fadeAnim = useRef(new Animated.Value(1)).current; // Initial opacity is 1 (visible)
    const scaleAnim = useRef(new Animated.Value(1)).current; // Initial scale is 1 (normal size)
    const blurAnim = useRef(new Animated.Value(0)).current; // Initial blur is 0 (no blur)
    
    // Crazy shake animation for auth errors
    const screenShakeX = useRef(new Animated.Value(0)).current;
    const screenShakeY = useRef(new Animated.Value(0)).current;
    const screenRotate = useRef(new Animated.Value(0)).current;
    
    // Sad emoji effects - create multiple flying emojis
    const [sadEmojis, setSadEmojis] = React.useState<Array<{
        id: number;
        leftPosition: number;
        animValue: Animated.Value;
        scaleAnim: Animated.Value;
        rotateAnim: Animated.Value;
        emoji: string;
    }>>([]);
    
    const { theme, name: themeName } = useTheme();
    const styles = useStyles();

    const triggerSadEmojis = () => {
        // Array of sad emojis to choose from
        const sadEmojiList = ['😢', '😭', '😞', '😔', '😿', '💔', '😩', '🥺', '😣', '😖'];
        
        // Create 8-12 random flying emojis
        const numEmojis = Math.floor(Math.random() * 5) + 8; // 8-12 emojis
        const newEmojis = [];
        
        for (let i = 0; i < numEmojis; i++) {
            const leftPosition = Math.random() * 100; // Random position 0-100%
            const animValue = new Animated.Value(-20); // Start above screen
            const scaleAnim = new Animated.Value(0.5); // Start small
            const rotateAnim = new Animated.Value(0); // Start with no rotation
            const delay = Math.random() * 500; // Random delay 0-500ms
            const emoji = sadEmojiList[Math.floor(Math.random() * sadEmojiList.length)];
            
            newEmojis.push({
                id: Date.now() + i,
                leftPosition,
                animValue,
                scaleAnim,
                rotateAnim,
                emoji,
            });
            
            // Animate the emoji flying down while growing and rotating
            Animated.parallel([
                // Fall down
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(animValue, {
                        toValue: 120, // Fall past the screen
                        duration: 1500 + Math.random() * 1000, // Random speed 1500-2500ms
                        useNativeDriver: true,
                    }),
                ]),
                // Grow in size
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(scaleAnim, {
                        toValue: 1.5 + Math.random() * 1.5, // Grow to 1.5x-3x size
                        duration: 1000 + Math.random() * 500,
                        useNativeDriver: true,
                    }),
                ]),
                // Rotate
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(rotateAnim, {
                        toValue: 360 * (Math.random() > 0.5 ? 1 : -1), // Full rotation, random direction
                        duration: 1500 + Math.random() * 1000,
                        useNativeDriver: true,
                    }),
                ]),
            ]).start();
        }
        
        setSadEmojis(newEmojis);
        
        // Clear emojis after animation
        setTimeout(() => {
            setSadEmojis([]);
        }, 3500);
    };

    const handleAuthError = () => {
        // Reset shake values
        screenShakeX.setValue(0);
        screenShakeY.setValue(0);
        screenRotate.setValue(0);
        
        // Trigger sad emojis
        triggerSadEmojis();
        
        // Create an even crazier shake for the whole screen
        Animated.parallel([
            // Diagonal shake pattern
            Animated.sequence([
                Animated.timing(screenShakeX, { toValue: 15, duration: 40, useNativeDriver: true }),
                Animated.timing(screenShakeX, { toValue: -15, duration: 40, useNativeDriver: true }),
                Animated.timing(screenShakeX, { toValue: 12, duration: 40, useNativeDriver: true }),
                Animated.timing(screenShakeX, { toValue: -12, duration: 40, useNativeDriver: true }),
                Animated.timing(screenShakeX, { toValue: 8, duration: 40, useNativeDriver: true }),
                Animated.timing(screenShakeX, { toValue: -8, duration: 40, useNativeDriver: true }),
                Animated.timing(screenShakeX, { toValue: 4, duration: 40, useNativeDriver: true }),
                Animated.timing(screenShakeX, { toValue: -4, duration: 40, useNativeDriver: true }),
                Animated.timing(screenShakeX, { toValue: 0, duration: 40, useNativeDriver: true }),
            ]),
            Animated.sequence([
                Animated.timing(screenShakeY, { toValue: -12, duration: 45, useNativeDriver: true }),
                Animated.timing(screenShakeY, { toValue: 12, duration: 45, useNativeDriver: true }),
                Animated.timing(screenShakeY, { toValue: -10, duration: 45, useNativeDriver: true }),
                Animated.timing(screenShakeY, { toValue: 10, duration: 45, useNativeDriver: true }),
                Animated.timing(screenShakeY, { toValue: -6, duration: 45, useNativeDriver: true }),
                Animated.timing(screenShakeY, { toValue: 6, duration: 45, useNativeDriver: true }),
                Animated.timing(screenShakeY, { toValue: -3, duration: 45, useNativeDriver: true }),
                Animated.timing(screenShakeY, { toValue: 3, duration: 45, useNativeDriver: true }),
                Animated.timing(screenShakeY, { toValue: 0, duration: 45, useNativeDriver: true }),
            ]),
            Animated.sequence([
                Animated.timing(screenRotate, { toValue: 3, duration: 80, useNativeDriver: true }),
                Animated.timing(screenRotate, { toValue: -3, duration: 80, useNativeDriver: true }),
                Animated.timing(screenRotate, { toValue: 2, duration: 80, useNativeDriver: true }),
                Animated.timing(screenRotate, { toValue: -2, duration: 80, useNativeDriver: true }),
                Animated.timing(screenRotate, { toValue: 0, duration: 80, useNativeDriver: true }),
            ]),
        ]).start();
    };

    const handleExpandBlobs = () => {
        animateToExpanded(); // Use context method
        
        // Create parallel animations for zoom effect (native driver)
        Animated.parallel([
            // Fade out the UI elements
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 800, // Fade out over 800ms
                useNativeDriver: true,
            }),
            // Scale up dramatically to simulate flying towards user
            Animated.timing(scaleAnim, {
                toValue: 3.5, // Scale to 3.5x size
                duration: 1200, // Scale over 1.2 seconds
                useNativeDriver: true,
            }),
        ]).start();
        
        // Blur animation runs separately (web only, can't use native driver)
        if (Platform.OS === 'web') {
            Animated.timing(blurAnim, {
                toValue: 10, // Maximum blur
                duration: 1000, // Blur over 1 second
                useNativeDriver: false,
            }).start();
        }
    };

    const handleShrinkBlobs = () => {
        animateToCollapsed(); // Use context method
        
        // Create parallel animations to reset zoom effect (native driver)
        Animated.parallel([
            // Fade in the UI elements
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600, // Fade in over 600ms
                useNativeDriver: true,
            }),
            // Scale back to normal size
            Animated.timing(scaleAnim, {
                toValue: 1, // Scale back to normal
                duration: 800, // Scale back over 800ms
                useNativeDriver: true,
            }),
        ]).start();
        
        // Remove blur effect separately (web only, can't use native driver)
        if (Platform.OS === 'web') {
            Animated.timing(blurAnim, {
                toValue: 0, // No blur
                duration: 600, // Remove blur over 600ms
                useNativeDriver: false,
            }).start();
        }
    };

    // Removed CSS link injection; font now loaded via expo-font in App.tsx

    useEffect(() => {
        if (Platform.OS === 'web') {
            const metaThemeColor = document.querySelector('meta[name="theme-color"]');
            if (metaThemeColor) {
                metaThemeColor.setAttribute('content', theme.colors.card);
            }
        }
        return () => {
            if (Platform.OS === 'web') {
                const metaThemeColor = document.querySelector('meta[name="theme-color"]');
                if (metaThemeColor) {
                    metaThemeColor.setAttribute('content', theme.colors.primary);
                }
            }
        };
    }, [theme]);

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor={theme.colors.card} />
            
            {/* Flying sad emojis overlay */}
            {sadEmojis.map((emojiItem) => (
                <Animated.View
                    key={emojiItem.id}
                    style={[
                        styles.emojiContainer,
                        {
                            left: `${emojiItem.leftPosition}%`,
                            transform: [
                                {
                                    translateY: emojiItem.animValue.interpolate({
                                        inputRange: [-20, 120],
                                        outputRange: ['-20%', '120%'],
                                    }),
                                },
                                { scale: emojiItem.scaleAnim },
                                {
                                    rotate: emojiItem.rotateAnim.interpolate({
                                        inputRange: [-360, 360],
                                        outputRange: ['-360deg', '360deg'],
                                    }),
                                },
                            ],
                        },
                    ]}
                >
                    <Text style={styles.emoji}>{emojiItem.emoji}</Text>
                </Animated.View>
            ))}
            
            <Animated.View 
                style={[
                    styles.contentContainer,
                    {
                        transform: [
                            { translateX: screenShakeX },
                            { translateY: screenShakeY },
                            {
                                rotate: screenRotate.interpolate({
                                    inputRange: [-3, 3],
                                    outputRange: ['-3deg', '3deg'],
                                }),
                            },
                        ],
                    },
                ]}
            >
                <Animated.View
                    style={[
                        styles.animatedContent,
                        {
                            opacity: fadeAnim,
                            transform: [{ scale: scaleAnim }],
                            ...(Platform.OS === 'web'
                                ? {
                                      filter: blurAnim.interpolate({
                                          inputRange: [0, 10],
                                          outputRange: ['blur(0px)', 'blur(10px)'],
                                          extrapolate: 'clamp',
                                      }),
                                  }
                                : {}),
                        },
                    ]}
                >
                    <Text style={[styles.appName, themeName === 'halloween' && { fontFamily: 'SpookyHalloween', fontWeight: '400' }]}>Frens</Text>
                    {/* {themeName === 'halloween' && ( 
                        <Text style={[
                            styles.appName,
                            {
                                // fontFamily: 'SpookyHalloween',
                                fontWeight: '400',
                                fontSize: 20,
                                transform: [{ rotate: '-12deg' }],
                                marginLeft: 100,
                                marginTop: -10,
                                marginBottom: 30,
                            }
                        ]}>Giving 🦃</Text>
                    {/* )} */}
                    {/* <Text style={[
                            styles.appName,
                            {
                                fontFamily: 'Holiday',
                                fontWeight: '400',
                                fontSize: 20,
                                transform: [{ rotate: '-12deg' }],
                                marginLeft: 100,
                                marginTop: -10,
                                marginBottom: 30,
                            }
                        ]}>sleigh edition</Text> */}
                    <Text style={styles.subtitle}>Connect with your community</Text>
                    <View style={styles.signInContainer}>
                        <Text style={styles.signInText}>Sign in to continue</Text>
                        <View style={styles.buttonWrapper}>
                            <EmailSignInButton
                                returnTo={returnTo}
                                navigation={navigation}
                                onPress={handleExpandBlobs}
                                onCancelPress={handleShrinkBlobs}
                                onAuthError={handleAuthError}
                            />
                        </View>
                    </View>
                </Animated.View>
            </Animated.View>
        </View>
    );
}

const useStyles = makeStyles(theme => ({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
        padding: 20,
        zIndex: 1,
    },
    emojiContainer: {
        position: 'absolute',
        top: 0,
        zIndex: 999,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emoji: {
        fontSize: 48,
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 4 },
        textShadowRadius: 8,
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        zIndex: 2,
        backgroundColor: 'transparent',
    },
    animatedContent: {
        alignItems: 'center',
        width: '100%',
        transformOrigin: 'center',
        zIndex: 3,
        backgroundColor: 'transparent',
    },
    appName: {
        fontSize: 48,
        fontWeight: '700',
        marginBottom: 8,
        letterSpacing: 1,
        textShadowColor: 'rgba(0, 0, 0, 0.1)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
        color: theme.colors.textPrimary,
    },
    buttonWrapper: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    subtitle: {
        fontSize: 18,
        color: theme.colors.textPrimary,
        marginBottom: 48,
    },
    signInContainer: {
        width: '100%',
        alignItems: 'center',
        elevation: 3,
        zIndex: 14,
    },
    signInText: {
        fontSize: 16,
        color: theme.colors.textPrimary,
        marginBottom: 16,
    },
}));