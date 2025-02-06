import { useState } from 'react'
import { supabase } from '../services/supabase'

interface EmailAuthResponse {
    user: {
        id: string
        email?: string
    } | null
    error: Error | null
}

export function useEmailAuth() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const signInWithEmail = async (email: string, password: string): Promise<EmailAuthResponse> => {
        setLoading(true)
        setError(null)

        try {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (signInError) throw signInError

            return {
                user: data.user,
                error: null,
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

    const signUpWithEmail = async (email: string, password: string): Promise<EmailAuthResponse> => {
        setLoading(true)
        setError(null)

        try {
            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
            })

            if (signUpError) throw signUpError

            return {
                user: data.user,
                error: null,
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
        signInWithEmail,
        signUpWithEmail,
        loading,
        error,
    }
}