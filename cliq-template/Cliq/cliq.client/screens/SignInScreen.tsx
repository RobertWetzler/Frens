import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppleSignInButton } from '../components/AppleSignInButton';
import AnimatedBackground from '../components/AnimatedBackground';

export default function SignInScreen() {
    return (
        <View style={styles.container}>
            <AnimatedBackground />
            <View style={styles.contentContainer}>
                <Text style={styles.appName}>Frens</Text>
                <Text style={styles.subtitle}>Connect with your community</Text>
                <View style={styles.signInContainer}>
                    <Text style={styles.signInText}>Sign in to continue</Text>
                    <AppleSignInButton />
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    signInText: {
        fontSize: 16,
        color: '#666',
        marginBottom: 16,
    },
});