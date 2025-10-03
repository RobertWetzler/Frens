import { Platform, Pressable, Text } from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import { useAppleAuth } from '../hooks/useAppleAuth'
import { useTheme } from '../theme/ThemeContext'
import { makeStyles } from '../theme/makeStyles'

export const AppleSignInButton = () => {
    const { signInWithApple, loading } = useAppleAuth()
    const styles = useStyles();

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
// makeStyles at bottom
const useStyles = makeStyles((theme) => ({
    button: {
        width: '100%',
        height: 44,
    },
    webButton: {
        width: '100%',
        height: 44,
        backgroundColor: theme.colors.textPrimary, // using textPrimary as dark surface (could add brandAppleBlack token later)
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 5,
    },
    webButtonText: {
        color: theme.colors.card,
        fontSize: 16,
        fontWeight: '600',
    },
}));