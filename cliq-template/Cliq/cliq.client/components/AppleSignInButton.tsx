import { Platform, View, Pressable, Text, StyleSheet } from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import { useAppleAuth } from '../hooks/useAppleAuth'

export const AppleSignInButton = () => {
    const { signInWithApple, loading } = useAppleAuth()

    const handleSignIn = async () => {
        try {
            const { user, error } = await signInWithApple()
            if (error) throw error

            if (user) {
                // Handle successful sign in (e.g., navigation)
                console.log('Signed in:', user)
            }
        } catch (error) {
            console.error('Sign in error:', error)
            // Handle error (e.g., show error message)
        }
    }

    if (Platform.OS === 'ios') {
        return (
            <AppleAuthentication.AppleAuthenticationButton
                buttonType= { AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN }
                buttonStyle = { AppleAuthentication.AppleAuthenticationButtonStyle.BLACK }
                cornerRadius = {5}
                style = { styles.button }
                onPress = { handleSignIn }
            />
    )
  }

    return (
        <Pressable
            style={styles.webButton}
            onPress={handleSignIn}
            disabled={loading}
        >
            <Text style={styles.webButtonText}>
                {loading ? 'Signing in...' : 'Sign in with Apple'}
            </Text>
        </Pressable>
    )
}

const styles = StyleSheet.create({
    button: {
        width: '100%',
        height: 44,
    },
    webButton: {
        width: '100%',
        height: 44,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 5,
    },
    webButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
})