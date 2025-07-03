import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, StatusBar, Platform, Button, Animated } from 'react-native';
import ShaderBackground, { ShaderBackgroundRef } from '../components/ShaderBackground';
import { EmailSignInButton } from 'components/EmailSignInButton';

interface SignInScreenProps {
  route?: { params?: { returnTo?: string } };
  navigation?: any;
}

export default function SignInScreen({ route, navigation }: SignInScreenProps) {
    const returnTo = route?.params?.returnTo;
    const shaderRef = useRef<ShaderBackgroundRef>(null);
    const fadeAnim = useRef(new Animated.Value(1)).current; // Initial opacity is 1 (visible)
    const scaleAnim = useRef(new Animated.Value(1)).current; // Initial scale is 1 (normal size)
    const blurAnim = useRef(new Animated.Value(0)).current; // Initial blur is 0 (no blur)

    const handleExpandBlobs = () => {
        shaderRef.current?.animateRadius(0.85, 300000); // Animate to 0.8 over 2 seconds
        
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
        shaderRef.current?.animateRadius(0.18, 10000); // Animate back to 0.18 over 1 second
        
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

    useEffect(() => {
        // Update the DOM directly to chagne the top bar to be white, for aesthetic consistency
        // TODO: Change default to white and only make purple on homeScreen
        // This is only necessary for web, as React Native handles status bar on mobile
        if (Platform.OS === 'web') {
            // Update theme color for this screen
            const metaThemeColor = document.querySelector('meta[name="theme-color"]');
            if (metaThemeColor) {
                metaThemeColor.setAttribute('content', '#FFFFFF');
            }
        }
        
        return () => {
            if (Platform.OS === 'web') {
                // Reset to default when leaving screen
                const metaThemeColor = document.querySelector('meta[name="theme-color"]');
                if (metaThemeColor) {
                    metaThemeColor.setAttribute('content', '#8C66FF'); // or your default color
                }
            }
        };
    }, []);

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor="#FFFFFF" />
            <ShaderBackground ref={shaderRef} />
            <View style={styles.contentContainer}>
                <Animated.View style={[
                    styles.animatedContent, 
                    { 
                        opacity: fadeAnim,
                        transform: [{ scale: scaleAnim }],
                        // Add blur effect for web platforms
                        ...(Platform.OS === 'web' ? {
                            filter: blurAnim.interpolate({
                                inputRange: [0, 10],
                                outputRange: ['blur(0px)', 'blur(10px)'],
                                extrapolate: 'clamp',
                            }),
                        } : {
                            // For mobile, we can simulate motion blur with reduced opacity during scaling
                            opacity: Animated.multiply(
                                fadeAnim,
                                blurAnim.interpolate({
                                    inputRange: [0, 10],
                                    outputRange: [1, 0.7],
                                    extrapolate: 'clamp',
                                })
                            ),
                        }),
                    }
                ]}>
                    <Text style={styles.appName}>Frens</Text>
                    <Text style={styles.subtitle}>Connect with your community</Text>
                    <View style={styles.signInContainer}>
                        <Text style={styles.signInText}>Sign in to continue</Text>
                        {/* <Button title="Expand Blobs" onPress={handleExpandBlobs} />
                        <Button title="Shrink Blobs" onPress={handleShrinkBlobs} /> */}
                        <View style={styles.buttonWrapper}>
                            <EmailSignInButton returnTo={returnTo} navigation={navigation} 
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
        padding: 20,
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden', // Prevent content from spilling outside container
    },
    animatedContent: {
        alignItems: 'center',
        width: '100%',
        // Ensure the content can scale without being clipped
        transformOrigin: 'center',
    },
    appName: {
        fontSize: 48,
        fontWeight: '700',
        marginBottom: 8,
        letterSpacing: 1,
        // Adding a subtle text shadow for depth
        textShadowColor: 'rgba(0, 0, 0, 0.1)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    buttonWrapper: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    subtitle: {
        fontSize: 18,
        color: '#000',
        marginBottom: 48,
    },
    signInContainer: {
        width: '100%',
        alignItems: 'center',
        // Adding subtle container shadow similar to your other component
        //shadowColor: '#000',
        //shadowOffset: { width: 0, height: 2 },
        //shadowOpacity: 0.1,
        //shadowRadius: 4,
        elevation: 3,
    },
    signInText: {
        fontSize: 16,
        color: '#000',
        marginBottom: 16,
    },
});