import { useState } from 'react'
import { supabase } from '../services/supabase'
import { ApiClient } from 'services/apiClient'
import { ISignInResponseDto, LoginModel, RegisterModel } from 'services/generated/generatedClient'

export interface EmailAuthResponse {
    result?: ISignInResponseDto | undefined
    error?: Error | undefined
}

export function useEmailAuth() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const signInWithEmail = async (email: string, password: string): Promise<EmailAuthResponse> => {
        setLoading(true)
        setError(null)

        try {
            const signInResponse = await ApiClient.call(c => c.login(new LoginModel({email, password})));
            return  { result: signInResponse }
        } catch (err) {
            setError(err instanceof Error ? err : new Error('An unknown error occurred'))
            return {
                result: null,
                error: err instanceof Error ? err : new Error('An unknown error occurred'),
            }
        } finally {
            setLoading(false)
        }
    }

    const signUpWithEmail = async (name: string, email: string, password: string): Promise<EmailAuthResponse> => {
        setLoading(true)
        setError(null)

        try {
            const registerResponse = await ApiClient.call(c => c.register(new RegisterModel({name, email, password})));
            return { result: registerResponse }
        } catch (err) {
            setError(err instanceof Error ? err : new Error('An unknown error occurred'))
            return {
                result: null,
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