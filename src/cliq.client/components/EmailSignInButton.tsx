import { useState, useRef, useEffect } from 'react'
import { View, Pressable, Text, StyleSheet, TextInput, Modal, Animated } from 'react-native'
import { EmailAuthResponse, useEmailAuth } from '../hooks/useEmailAuth'
import { DateInput } from './DateInput'
import { TermsOfService } from './TermsOfService'
import { useTheme } from '../theme/ThemeContext'
import { makeStyles } from '../theme/makeStyles'
import { useAuth } from 'contexts/AuthContext'
import { ISignInResponseDto } from 'services/generated/generatedClient'
import * as Linking from 'expo-linking';

interface EmailSignInButtonProps {
    returnTo?: string;
    navigation?: any;
    onPress?: () => void;
    onCancelPress?: () => void;
    onAuthError?: () => void;
}

export const EmailSignInButton = ({ returnTo, navigation, onPress, onCancelPress, onAuthError }: EmailSignInButtonProps) => {
    const { theme } = useTheme();
    const styles = useStyles();
    const { login } = useAuth();

    const { signInWithEmail, signUpWithEmail, loading } = useEmailAuth()
    const [modalVisible, setModalVisible] = useState(false)
    const [email, setEmail] = useState('')
    const [username, setName] = useState('')
    const [password, setPassword] = useState('')
    const [isSignUp, setIsSignUp] = useState(false)
    // Stuff for TOS, Age Verification
    const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null)
    const [dateError, setDateError] = useState<string>('')
    const [passwordError, setPasswordError] = useState<string>('')
    const [submitError, setSubmitError] = useState<Error>(null)
    const [tosAccepted, setTosAccepted] = useState(false)
    const [showTos, setShowTos] = useState(false)
    
    // Animation refs for shake effect
    const shakeAnim = useRef(new Animated.Value(0)).current
    const rotateAnim = useRef(new Animated.Value(0)).current
    const scaleAnim = useRef(new Animated.Value(1)).current

    const passwordInputRef = useRef<TextInput>(null)

    // Crazy shake animation for failed authentication
    const triggerCrazyShake = () => {
        // Reset animations
        shakeAnim.setValue(0)
        rotateAnim.setValue(0)
        scaleAnim.setValue(1)
        
        // Create a crazy shake sequence with rotation and scaling
        Animated.sequence([
            // First: rapid horizontal shake with rotation
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: 5, duration: 50, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: -5, duration: 50, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
                ]),
                Animated.sequence([
                    Animated.timing(rotateAnim, { toValue: 5, duration: 100, useNativeDriver: true }),
                    Animated.timing(rotateAnim, { toValue: -5, duration: 100, useNativeDriver: true }),
                    Animated.timing(rotateAnim, { toValue: 3, duration: 100, useNativeDriver: true }),
                    Animated.timing(rotateAnim, { toValue: -3, duration: 100, useNativeDriver: true }),
                    Animated.timing(rotateAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
                ]),
            ]),
            // Second: bounce scale effect
            Animated.sequence([
                Animated.timing(scaleAnim, { toValue: 1.1, duration: 100, useNativeDriver: true }),
                Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
                Animated.timing(scaleAnim, { toValue: 1.05, duration: 100, useNativeDriver: true }),
                Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
            ]),
        ]).start()
    }

    const validateAge = (dob: Date): boolean => {
        const today = new Date()
        const age = today.getFullYear() - dob.getFullYear()
        const monthDiff = today.getMonth() - dob.getMonth()

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
            return age - 1 >= 13
        }
        return age >= 13
    }

    const validatePassword = (password: string): string[] => {
        const errors: string[] = []
        
        if (password.length < 6) {
            errors.push("Passwords must be at least 6 characters.")
        }
        
        if (!/[^a-zA-Z0-9]/.test(password)) {
            errors.push("Passwords must have at least one non alphanumeric character.")
        }
        
        if (!/[0-9]/.test(password)) {
            errors.push("Passwords must have at least one digit ('0'-'9').")
        }
        
        if (!/[A-Z]/.test(password)) {
            errors.push("Passwords must have at least one uppercase ('A'-'Z').")
        }
        
        return errors
    }

    const handleSignUp = async (): Promise<EmailAuthResponse> => {
        // Clear previous errors
        setPasswordError('')
        setSubmitError(null)
        
        if (!username || username.trim() === '') {
            setSubmitError(new Error('Please enter your name'))
            return
        }
        
        if (!dateOfBirth) {
            setDateError('Please enter your date of birth')
            return
        }

        if (!validateAge(dateOfBirth)) {
            setDateError('You must be at least 13 years old to use this platform')
            return
        }
        setDateError('')

        // Validate password before proceeding
        const passwordErrors = validatePassword(password)
        if (passwordErrors.length > 0) {
            setPasswordError(passwordErrors.join(' '))
            return
        }

        if (!tosAccepted) {
            setSubmitError(new Error('Please accept the Terms of Service to continue'))
            return
        }

        // Proceed with sign up
        try {
            return await signUpWithEmail(username, email, password)
        } catch (error) {
            console.error('Sign up error:', error)
            setSubmitError(error)
            throw error
        }
    }

    const resetForm = () => {
        setName('')
        setEmail('')
        setPassword('')
        setDateOfBirth(null)
        setTosAccepted(false)
        setDateError('')
        setPasswordError('')
        setSubmitError(null)
    }

    const handlePostLoginRedirect = async () => {
        if (returnTo) {
            try {
                console.log('Redirecting to:', returnTo);
                // Use Linking to navigate to the original URL
                await Linking.openURL(returnTo);
            } catch (error) {
                console.error('Error redirecting to original URL:', error);
                // Fallback: close modal and let normal auth flow handle navigation
                setModalVisible(false);
            }
        } else {
            // No redirect URL, just close the modal and let auth state change handle navigation
            setModalVisible(false);
        }
    }

    const handleAuth = async () => {
        try {
            let authResponse: EmailAuthResponse;
            if (isSignUp) {
                authResponse = await handleSignUp();
            } else {
                // Clear password error for sign in
                setPasswordError('')
                authResponse = await signInWithEmail(email, password);
            }

            const { result, error } = authResponse;

            // Check for error first and trigger animation
            if (error) {

                // // Trigger crazy shake animation on error
                // triggerCrazyShake()
                
                // // Notify parent component about auth error
                // onAuthError?.()
                
                throw error;
            }

            if (result && result.user && result.token) {
                await login(result.token, {
                    id: result.user.id,
                    email: email,
                    username: result.user.name
                });
                console.log('Authenticated:', result.user)
                
                // Reset form
                resetForm()
                
                // Handle post-login redirect
                await handlePostLoginRedirect();
            }
        } catch (error) {
            console.error('Authentication error:', error)
            
            // Trigger crazy shake animation on error
            triggerCrazyShake()
            
            // Notify parent component about auth error
            onAuthError?.()
            
            // Set error message based on mode
            if (isSignUp) {
                // For sign up, errors are already handled in handleSignUp
                setSubmitError(error)
            } else {
                // For sign in, show custom error message
                setSubmitError(new Error("YOU SHALL NOT PASS 🧙‍♂️ (your password may be incorrect)"))
            }
        }
    }
    
    const handleButtonPress = () => {
        // Wait 3 seconds before showing the modal
        setTimeout(() => {
            setModalVisible(true);
        }, 1750);
        // Call the parent callback
        onPress?.();
    };

    const handleCancelButtonPress = () => {
        // Wait 3 seconds before showing the modal
        setModalVisible(false);
        // Call the parent callback
        onCancelPress?.();
    };

    const handleTosPress = () => {
        console.log('ToS pressed') // For debugging
        setShowTos(true)
    }
    
    return (
        <View>
            <Pressable
                style={styles.button}
                onPress={handleButtonPress}
                disabled={loading}
            >
                <Text style={styles.buttonText}>
                    {loading ? 'Processing...' : 'Sign in'}
                </Text>
            </Pressable>

            <Modal
                animationType="fade"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={[styles.modalContainer, { zIndex: 2 }]}>
                    <Animated.View
                        style={[
                            styles.modalContent,
                            {
                                transform: [
                                    { translateX: shakeAnim },
                                    {
                                        rotate: rotateAnim.interpolate({
                                            inputRange: [-5, 5],
                                            outputRange: ['-5deg', '5deg'],
                                        }),
                                    },
                                    { scale: scaleAnim },
                                ],
                            },
                        ]}
                    >
                        <Text style={styles.modalTitle}>
                            {isSignUp ? 'Create Account' : 'Sign In'}
                        </Text>

                        {isSignUp && (<TextInput
                            style={styles.input}
                            placeholder="Name"
                            placeholderTextColor={theme.colors.inputPlaceholder}
                            value={username}
                            onChangeText={setName}
                            autoCapitalize="none"
                            returnKeyType="next"
                            onSubmitEditing={() => passwordInputRef.current?.focus()}
                        />)}

                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor={theme.colors.inputPlaceholder}
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            textContentType="emailAddress"
                            autoComplete="email"
                            inputMode="email"
                            returnKeyType="next"
                            onSubmitEditing={() => passwordInputRef.current?.focus()}
                        />

                        <TextInput
                            ref={passwordInputRef}
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor={theme.colors.inputPlaceholder}
                            value={password}
                            onChangeText={(text) => {
                                setPassword(text)
                                // Clear password error when user starts typing
                                if (passwordError) {
                                    setPasswordError('')
                                }
                            }}
                            textContentType={isSignUp ? "newPassword" : "password"}
                            autoComplete={isSignUp ? "new-password" : "current-password"}
                            secureTextEntry
                            returnKeyType="done"
                            onSubmitEditing={handleAuth}
                        />

                        {/* Display password error */}
                        {passwordError && (
                            <View style={styles.passwordErrorContainer}>
                                <Text style={styles.errorText}>{passwordError}</Text>
                            </View>
                        )}

                        {/* Extra signup bits */}
                        {isSignUp && (
                            <>
                                <DateInput
                                    value={dateOfBirth}
                                    onChange={setDateOfBirth}
                                    error={dateError}
                                />

                                <View style={styles.tosContainer}>
                                    <Pressable
                                        style={styles.checkbox}
                                        onPress={() => setTosAccepted(!tosAccepted)}
                                    >
                                        <Text>{tosAccepted ? '✓' : ''}</Text>
                                    </Pressable>
                                    <Text style={styles.tosText}>
                                        I have read and agree to the{' '}
                                        <Pressable onPress={handleTosPress}>
                                            <Text style={styles.tosLink}>
                                                Terms of Service
                                            </Text>
                                        </Pressable>
                                        {/* {' '}and{' '} */}
                                        {/* <Pressable onPress={() => {/* Open Privacy Policy */ }
                                            {/* <Text style={styles.tosLink}>
                                                Privacy Policy
                                            </Text> */}
                                        {/* </Pressable> */}
                                    </Text>
                                </View>
                                {submitError && <Text style={styles.errorText}>{submitError.message}</Text>}
                            </>
                        )}

                        {/* Show submit error for sign-in as well */}
                        {!isSignUp && submitError && (
                            <View style={styles.passwordErrorContainer}>
                                <Text style={styles.errorText}>{submitError.message}</Text>
                            </View>
                        )}

                        <Pressable
                            style={styles.submitButton}
                            onPress={handleAuth}
                            disabled={loading}
                        >
                            <Text style={styles.submitButtonText}>
                                {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
                            </Text>
                        </Pressable>

                        <Pressable
                            style={styles.switchButton}
                            onPress={() => {
                                setIsSignUp(!isSignUp)
                                // Clear errors when switching modes
                                setPasswordError('')
                                setSubmitError(null)
                                setDateError('')
                            }}
                        >
                            <Text style={styles.switchButtonText}>
                                {isSignUp
                                    ? 'Already have an account? Sign in'
                                    : 'Need an account? Sign up'}
                            </Text>
                        </Pressable>

                        <Pressable
                            style={styles.closeButton}
                            onPress={handleCancelButtonPress}
                        >
                            <Text style={styles.closeButtonText}>Close</Text>
                        </Pressable>
                    </Animated.View>
                </View>
            </Modal>
            
            <TermsOfService
                isVisible={showTos}
                onClose={() => setShowTos(false)}
                onAccept={() => {
                    setTosAccepted(true)
                    setShowTos(false)
                }}
            />
        </View>
    )
}

// ...existing styles remain the same...
// makeStyles at bottom
const useStyles = makeStyles((theme) => ({
    button: {
        width: '100%',
        paddingHorizontal: 40,
        height: 50,
        backgroundColor: theme.colors.textPrimary, // using textPrimary as neutral dark button
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 5,
    },
    buttonText: {
        color: theme.colors.card,
        fontSize: 16,
        fontWeight: '600',
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '80%',
        maxWidth: 400,
        backgroundColor: theme.colors.card,
        borderRadius: 10,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.colors.separator,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        color: theme.colors.textPrimary,
    },
    input: {
        width: '100%',
        height: 44,
        borderWidth: 1,
        borderColor: theme.colors.inputBorder,
        borderRadius: 5,
        paddingHorizontal: 10,
        marginBottom: 10,
        fontSize: 16,
        color: theme.colors.textPrimary,
        backgroundColor: theme.colors.card,
    },
    submitButton: {
        width: '100%',
        height: 44,
        backgroundColor: theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 5,
        marginTop: 10,
    },
    submitButtonText: {
        color: theme.colors.primaryContrast,
        fontSize: 16,
        fontWeight: '600',
    },
    switchButton: {
        marginTop: 15,
    },
    switchButtonText: {
        color: theme.colors.primary,
        fontSize: 14,
    },
    closeButton: {
        marginTop: 15,
    },
    closeButtonText: {
        color: theme.colors.textSecondary,
        fontSize: 14,
    },
    tosContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderWidth: 1,
        borderColor: theme.colors.inputBorder,
        borderRadius: 3,
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tosText: {
        flex: 1,
        fontSize: 14,
        color: theme.colors.textSecondary,
    },
    tosLink: {
        color: theme.colors.primary,
        textDecorationLine: 'underline',
    },
    errorText: {
        color: theme.colors.danger,
        fontSize: 12,
        marginTop: 5,
    },
    passwordErrorContainer: {
        width: '100%',
        marginTop: 5,
        marginBottom: 5,
    }
}));