import React, { useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, Platform } from 'react-native';
import ShaderBackground from '../components/ShaderBackground';
import { EmailSignInButton } from 'components/EmailSignInButton';

interface SignInScreenProps {
  route?: { params?: { returnTo?: string } };
  navigation?: any;
}

export default function SignInScreen({ route, navigation }: SignInScreenProps) {
    const returnTo = route?.params?.returnTo;
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
            <ShaderBackground />
            <View style={styles.contentContainer}>
                <Text style={styles.appName}>Frens</Text>
                <Text style={styles.subtitle}>Connect with your community</Text>
                <View style={styles.signInContainer}>
                    <Text style={styles.signInText}>Sign in to continue</Text>
                    <EmailSignInButton returnTo={returnTo} navigation={navigation} />
                </View>
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
    subtitle: {
        fontSize: 18,
        color: '#666',
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
        color: '#666',
        marginBottom: 16,
    },
});