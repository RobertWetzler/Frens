import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const AUTH_TOKEN_KEY = 'AuthToken';
const REFRESH_TOKEN_KEY = 'RefreshToken';

export const tokenStorage = {
    // Save the auth token
    async setAuthToken(token: string): Promise<void> {
        if (Platform.OS === 'web') {
            localStorage.setItem(AUTH_TOKEN_KEY, token);
        } else {
            await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
        }
    },

    // Get the stored auth token
    async getAuthToken(): Promise<string | null> {
        if (Platform.OS === 'web') {
            return localStorage.getItem(AUTH_TOKEN_KEY);
        }
        return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    },

    // Remove the auth token (for logout)
    async removeAuthToken(): Promise<void> {
        if (Platform.OS === 'web') {
            localStorage.removeItem(AUTH_TOKEN_KEY);
        } else {
            await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
        }
    },

    // Optional: Handle refresh token if your auth system uses one
    async setRefreshToken(token: string): Promise<void> {
        if (Platform.OS === 'web') {
            localStorage.setItem(REFRESH_TOKEN_KEY, token);
        } else {
            await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
        }
    },

    async getRefreshToken(): Promise<string | null> {
        if (Platform.OS === 'web') {
            return localStorage.getItem(REFRESH_TOKEN_KEY);
        }
        return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    }
};