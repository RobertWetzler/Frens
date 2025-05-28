import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ShaderBackground from '../components/ShaderBackground';
import { EmailSignInButton } from 'components/EmailSignInButton';

interface SignInScreenProps {
  route?: { params?: { returnTo?: string } };
  navigation?: any;
}

export default function SignInScreen({ route, navigation }: SignInScreenProps) {
    const returnTo = route?.params?.returnTo;

    return (
        <View style={styles.container}>
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