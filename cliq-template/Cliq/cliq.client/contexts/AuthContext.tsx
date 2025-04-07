import React, { createContext, useState, useEffect, useContext } from 'react';
//import { EventEmitter } from 'events';
import { EventEmitter } from 'expo-modules-core';
import { tokenStorage } from '../utils/tokenStorage';
import { ApiClient } from 'services/apiClient';

// Define event type mapping properly
type AuthEventsMap = {
    'AUTH_STATE_CHANGE': (user: AuthUser | null) => void;
  };
  
  // Create event emitter with the correct type
  export const authEvents = new EventEmitter<AuthEventsMap>();
export const AUTH_STATE_CHANGE = 'AUTH_STATE_CHANGE';

export type AuthUser = {
    id: string;
    email: string;
    username?: string;
    // Add any other user properties here
};

type AuthContextType = {
    isAuthenticated: boolean;
    user: AuthUser | null;
    isAuthLoading: boolean;
    login: (token: string, userData: AuthUser) => Promise<void>;
    logout: () => Promise<void>;
    checkAuthStatus: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // Handle auth state changes
    useEffect(() => {
        // Properly typed event handler
        const authChangeHandler = (newUser: AuthUser | null): void => {
            setUser(newUser);
            setIsAuthenticated(!!newUser);
            // If logged out, reset the API client
            if (!newUser) {
                ApiClient.resetClient();
            }
        };

        // Use the proper method for adding listeners
        const subscription = authEvents.addListener(AUTH_STATE_CHANGE, authChangeHandler);

        // Check initial auth status
        checkAuthStatus();

        // Cleanup
        return () => {
            subscription.remove();
        };
    }, []);

    const parseUserFromToken = (token: string): { user: AuthUser, expiration: number } | null => {
        try {
            // TODO use a proper JWT decoder
            const payload = JSON.parse(atob(token.split('.')[1]));
            // TODO add test for expiration logic
            const expiration = payload.exp;
            const user: AuthUser = {
                id: payload.sub,
                email: payload.email,
                username: payload.username,
            };
            return { user, expiration };
        } catch (error) {
            console.error('Error parsing JWT:', error);
            return null;
        }
    };

    const checkAuthStatus = async (): Promise<boolean> => {
        try {
            setIsLoading(true);
            const token = await tokenStorage.getAuthToken();

            if (token) {
                // Parse user data from token
                const { user, expiration } = parseUserFromToken(token);
                if (expiration && expiration < Date.now()) {
                    // Token is expired
                    await tokenStorage.removeAuthToken();
                    setUser(null);
                    setIsAuthenticated(false);
                    return false;
                }
                if (user) {
                    setUser(user);
                    setIsAuthenticated(true);
                    return true;
                }
            }

            // If we reach here, no valid auth was found
            setUser(null);
            setIsAuthenticated(false);
            return false;
        } catch (error) {
            console.error('Error checking auth status:', error);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (token: string, userData: AuthUser): Promise<void> => {
        try {
            await tokenStorage.setAuthToken(token);
            setUser(userData);
            setIsAuthenticated(true);
            // Emit event for other parts of the app
            authEvents.emit(AUTH_STATE_CHANGE, userData);
        } catch (error) {
            console.error('Error during login:', error);
            throw error;
        }
    };

    const logout = async (): Promise<void> => {
        try {
            await tokenStorage.removeAuthToken();
            // await tokenStorage.removeRefreshToken();
            setUser(null);
            setIsAuthenticated(false);
            ApiClient.resetClient();
            // Emit event for other parts of the app
            authEvents.emit(AUTH_STATE_CHANGE, null);
        } catch (error) {
            console.error('Error during logout:', error);
            throw error;
        }
    };

    return (
        <AuthContext.Provider
            value={{
                isAuthenticated,
                user,
                isAuthLoading: isLoading,
                login,
                logout,
                checkAuthStatus,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};