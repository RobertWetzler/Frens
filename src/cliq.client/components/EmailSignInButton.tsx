import { useState, useRef, useEffect } from 'react'
import { View, Pressable, Text, StyleSheet, TextInput, Modal, Animated } from 'react-native'
import { EmailAuthResponse, useEmailAuth } from '../hooks/useEmailAuth'
import { DateInput } from './DateInput'
import { TermsOfService } from './TermsOfService'
import { useAuth } from 'contexts/AuthContext'
import { ISignInResponseDto } from 'services/generated/generatedClient'
import * as Linking from 'expo-linking';

interface EmailSignInButtonProps {
    returnTo?: string;
    navigation?: any;
    onPress?: () => void;
    onCancelPress?: () => void;
}

export const EmailSignInButton = ({ returnTo, navigation, onPress, onCancelPress }: EmailSignInButtonProps) => {
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
    const [submitError, setSubmitError] = useState<Error>(null)
    const [tosAccepted, setTosAccepted] = useState(false)
    const [showTos, setShowTos] = useState(false)

    const passwordInputRef = useRef<TextInput>(null)

    const validateAge = (dob: Date): boolean => {
        const today = new Date()
        const age = today.getFullYear() - dob.getFullYear()
        const monthDiff = today.getMonth() - dob.getMonth()

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
            return age - 1 >= 13
        }
        return age >= 13
    }

    const handleSignUp = async (): Promise<EmailAuthResponse> => {
        if (!dateOfBirth) {
            setDateError('Please enter your date of birth')
            return
        }

        if (!validateAge(dateOfBirth)) {
            setDateError('You must be at least 13 years old to use this platform')
            return
        }
        setDateError('')

        if (!tosAccepted) {
            setSubmitError(new Error('Please accept the Terms of Service to continue'))
            return
        }
        setSubmitError(null)

        // Proceed with sign up
        try {
            return await signUpWithEmail(username, email, password)
        } catch (error) {
            console.error('Sign up error:', error)
        }
    }

    const resetForm = () => {
        setName('')
        setEmail('')
        setPassword('')
        setDateOfBirth(null)
        setTosAccepted(false)
        setDateError('')
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
            let result: ISignInResponseDto, error: Error;
            if (isSignUp) {
                ({ result, error } = await handleSignUp());
            } else {
                ({ result, error } = await signInWithEmail(email, password));
            }

            if (error) throw error

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
            // Handle error (e.g., show error message)
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
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>
                            {isSignUp ? 'Create Account' : 'Sign In'}
                        </Text>

                        {isSignUp && (<TextInput
                            style={styles.input}
                            placeholder="Name"
                            placeholderTextColor="#666"
                            value={username}
                            onChangeText={setName}
                            autoCapitalize="none"
                            returnKeyType="next"
                            onSubmitEditing={() => passwordInputRef.current?.focus()}
                        />)}

                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor="#666"
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
                            placeholderTextColor="#666"
                            value={password}
                            onChangeText={setPassword}
                            textContentType={isSignUp ? "newPassword" : "password"}
                            autoComplete={isSignUp ? "new-password" : "current-password"}
                            secureTextEntry
                            returnKeyType="done"
                            onSubmitEditing={handleAuth}
                        />

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
                                        {' '}and{' '}
                                        <Pressable onPress={() => {/* Open Privacy Policy */ }}>
                                            <Text style={styles.tosLink}>
                                                Privacy Policy
                                            </Text>
                                        </Pressable>
                                    </Text>
                                </View>
                                {submitError && <Text style={styles.errorText}>{submitError.message}</Text>}
                            </>
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
                            onPress={() => setIsSignUp(!isSignUp)}
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
                    </View>
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
const styles = StyleSheet.create({
    button: {
        width: '100%',
        paddingHorizontal: 40,
        height: 50,
        backgroundColor: 'black',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 5,
        //marginHorizontal: 20,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
       // backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1,
    },
    modalContent: {
        width: '80%',
        maxWidth: 400, // Add this to limit the width on desktop
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 20,
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    input: {
        width: '100%',
        height: 44,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 5,
        paddingHorizontal: 10,
        marginBottom: 10,
    },
    submitButton: {
        width: '100%',
        height: 44,
        backgroundColor: '#4A90E2',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 5,
        marginTop: 10,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    switchButton: {
        marginTop: 15,
    },
    switchButtonText: {
        color: '#4A90E2',
        fontSize: 14,
    },
    closeButton: {
        marginTop: 15,
    },
    closeButtonText: {
        color: '#666',
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
        borderColor: '#ddd',
        borderRadius: 3,
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tosText: {
        flex: 1,
        fontSize: 14,
        color: '#666',
    },
    tosLink: {
        color: '#4A90E2',
        textDecorationLine: 'underline',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
    },
    scrollView: {
        maxHeight: '70%',
        marginBottom: 15,
    },
    termsText: {
        fontSize: 14,
        lineHeight: 20,
        color: '#333',
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    acceptButton: {
        flex: 1,
        height: 44,
        backgroundColor: '#4A90E2',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 5,
        marginLeft: 5,
    },
    acceptButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    declineButton: {
        flex: 1,
        height: 44,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#ddd',
        marginRight: 5,
    },
    declineButtonText: {
        color: '#666',
        fontSize: 16,
    },
    errorText: {
        color: 'red',
        fontSize: 12,
        marginTop: 5,
    }
})