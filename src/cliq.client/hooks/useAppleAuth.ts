import { useState } from 'react'
import { Platform } from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import { supabase } from '../services/supabase'

interface AppleAuthResponse {
    user: {
        id: string
        email?: string
        name?: string
    } | null
    error: Error | null
}
// Supabase docs: https://supabase.com/docs/guides/auth/social-login/auth-apple?queryGroups=platform&platform=react-native
export function useAppleAuth() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const signInWithApple = async (): Promise<AppleAuthResponse> => {
        setLoading(true)
        setError(null)

        try {
            if (Platform.OS === 'ios') {
                try {
                    // Native iOS Sign In
                    const credential = await AppleAuthentication.signInAsync({
                        requestedScopes: [
                            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                            AppleAuthentication.AppleAuthenticationScope.EMAIL,
                        ],
                    })
                    if (credential.identityToken) {

                        const { data, error: signInError } = await supabase.auth.signInWithIdToken({
                            provider: 'apple',
                            token: credential.identityToken!,
                        })
                        //console.log(JSON.stringify({ signInError, data }, null, 2))
                        if (signInError) throw signInError;

                        return {
                            user: data.user,
                            error: null,
                        }
                    }
                }
                catch (e) {
                    if (e.code === 'ERR_REQUEST_CANCELED') {
                        // handle that the user canceled the sign-in flow
                    } else {
                        // handle other errors
                    }
                    throw e;
                }
            } else {
                // Web/PWA Sign In
                const { data, error: signInError } = await supabase.auth.signInWithOAuth({
                    provider: 'apple',
                    options: {
                        redirectTo: window.location.origin,
                        // Add any additional OAuth options here
                    },
                })

                if (signInError) throw signInError

                // On web, this will redirect the user to Apple's sign-in page
                // The user object will be available after the redirect back to our app
                return {
                    user: null,
                    error: null,
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err : new Error('An unknown error occurred'))
            return {
                user: null,
                error: err instanceof Error ? err : new Error('An unknown error occurred'),
            }
        } finally {
            setLoading(false)
        }
    }

    return {
        signInWithApple,
        loading,
        error,
    }
}