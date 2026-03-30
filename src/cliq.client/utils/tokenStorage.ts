import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const AUTH_TOKEN_KEY = 'AuthToken';
const REFRESH_TOKEN_KEY = 'RefreshToken';

// In-memory fallback for environments where localStorage throws SecurityError
// (e.g. old Safari, Safari private browsing, very old iOS)
const memoryStore = new Map<string, string>();

function webGet(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return memoryStore.get(key) ?? null;
    }
}

function webSet(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch {
        // localStorage unavailable — fall back to in-memory storage
    }
    memoryStore.set(key, value);
}

function webRemove(key: string): void {
    try {
        localStorage.removeItem(key);
    } catch {
        // localStorage unavailable
    }
    memoryStore.delete(key);
}

export const tokenStorage = {
    async setAuthToken(token: string): Promise<void> {
        if (Platform.OS === 'web') {
            webSet(AUTH_TOKEN_KEY, token);
        } else {
            await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
        }
    },

    async getAuthToken(): Promise<string | null> {
        if (Platform.OS === 'web') {
            return webGet(AUTH_TOKEN_KEY);
        }
        return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    },

    async removeAuthToken(): Promise<void> {
        if (Platform.OS === 'web') {
            webRemove(AUTH_TOKEN_KEY);
        } else {
            await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
        }
    },

    async setRefreshToken(token: string): Promise<void> {
        if (Platform.OS === 'web') {
            webSet(REFRESH_TOKEN_KEY, token);
        } else {
            await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
        }
    },

    async getRefreshToken(): Promise<string | null> {
        if (Platform.OS === 'web') {
            return webGet(REFRESH_TOKEN_KEY);
        }
        return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    }
};