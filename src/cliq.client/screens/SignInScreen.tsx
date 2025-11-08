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
    const { theme, name: themeName } = useTheme();
    const styles = useStyles();

    const handleExpandBlobs = () => {
        animateToExpanded(); // Use context method
        
        // Create parallel animations for zoom effect
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
            // Add blur effect during zoom
            Animated.timing(blurAnim, {
                toValue: 10, // Maximum blur
                duration: 1000, // Blur over 1 second
                useNativeDriver: false, // Blur can't use native driver
            }),
        ]).start();
    };

    const handleShrinkBlobs = () => {
        animateToCollapsed(); // Use context method
        
        // Create parallel animations to reset zoom effect
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
            // Remove blur effect
            Animated.timing(blurAnim, {
                toValue: 0, // No blur
                duration: 600, // Remove blur over 600ms
                useNativeDriver: false,
            }),
        ]).start();
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
            <View style={styles.contentContainer}>
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
                                : {
                                      opacity: Animated.multiply(
                                          fadeAnim,
                                          blurAnim.interpolate({
                                              inputRange: [0, 10],
                                              outputRange: [1, 0.7],
                                              extrapolate: 'clamp',
                                          })
                                      ),
                                  }),
                        },
                    ]}
                >
                    <Text style={[styles.appName, themeName === 'halloween' && { fontFamily: 'SpookyHalloween', fontWeight: '400' }]}>Frens</Text>
                    {themeName === 'halloween' && (
                        <Text style={[
                            styles.appName,
                            {
                                fontFamily: 'SpookyHalloween',
                                fontWeight: '400',
                                fontSize: 20,
                                transform: [{ rotate: '-12deg' }],
                                marginLeft: 100,
                                marginTop: -10,
                                marginBottom: 30,
                            }
                        ]}>Spooky Edition</Text>
                    )}
                    <Text style={styles.subtitle}>Connect with your community</Text>
                    <View style={styles.signInContainer}>
                        <Text style={styles.signInText}>Sign in to continue</Text>
                        <View style={styles.buttonWrapper}>
                            <EmailSignInButton
                                returnTo={returnTo}
                                navigation={navigation}
                                onPress={handleExpandBlobs}
                                onCancelPress={handleShrinkBlobs}
                            />
                        </View>
                    </View>
                </Animated.View>
            </View>
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