import { ApiException, Client } from 'services/generated/generatedClient'
import getEnvVars from 'env'
import { tokenStorage } from 'utils/tokenStorage';
import { authEvents, AUTH_STATE_CHANGE } from '../contexts/AuthContext';


export class ApiClient {
    private static instance: Client | null = null;
    private static currentToken: string | null = null;
    private static isRefreshing = false;
    private static refreshPromise: Promise<string | null> | null = null;
    private static pendingRequests: Array<() => void> = [];

    static async getInstance(): Promise<Client> {
        const token = await tokenStorage.getAuthToken()

        // If we have an instance and the token hasn't changed, return it
        if (this.instance && this.currentToken === token) {
            return this.instance;
        }

        const customFetch = {
            fetch: async (url: RequestInfo, init?: RequestInit) => {
                const token = await tokenStorage.getAuthToken();

                // First attempt with current token
                const response = await window.fetch(url, {
                    ...init,
                    headers: {
                        ...init?.headers,
                        'Authorization': token ? `Bearer ${token}` : '',
                        'Content-Type': 'application/json',
                    }
                });

                /* TODO: Implement token refresh on backend

                // If unauthorized and we have a token, try to refresh
                if (response.status === 401 && token) {
                    const newToken = await this.handleTokenRefresh();
                    
                    // If we got a new token, retry the request
                    if (newToken) {
                        return window.fetch(url, {
                            ...init,
                            headers: {
                                ...init?.headers,
                                'Authorization': `Bearer ${newToken}`,
                                'Content-Type': 'application/json',
                            }
                        });
                    }
                    
                    // If refresh failed, propagate 401 and let app handle logout
                    this.signalAuthFailure();
                }
                */
                return response;
            }
        }

        this.instance = new Client(getEnvVars().API_URL, customFetch);
        this.currentToken = token;
        return this.instance;
    }

    private static async handleTokenRefresh(): Promise<string | null> {
        // If already refreshing, wait for that to complete
        if (this.isRefreshing) {
            return await this.refreshPromise;
        }
        
        // Start refresh process
        this.isRefreshing = true;
        
        this.refreshPromise = (async () => {
            try {
                const refreshToken = await tokenStorage.getRefreshToken();
                if (!refreshToken) return null;
                
                // Call your refresh token endpoint
                const response = await fetch(`${getEnvVars().API_URL}/auth/refresh`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken })
                });
                
                if (!response.ok) {
                    throw new Error('Token refresh failed');
                }
                
                const data = await response.json();
                
                // Update stored tokens
                await tokenStorage.setAuthToken(data.token);
                if (data.refreshToken) {
                    await tokenStorage.setRefreshToken(data.refreshToken);
                }
                
                // Update the client's current token
                this.currentToken = data.token;
                
                // Execute any pending requests
                this.pendingRequests.forEach(callback => callback());
                this.pendingRequests = [];
                
                return data.token;
            } catch (error) {
                console.error('Token refresh failed:', error);
                await this.clearTokens();
                return null;
            } finally {
                this.isRefreshing = false;
                this.refreshPromise = null;
            }
        })();
        
        return await this.refreshPromise;
    }

    private static async clearTokens() {
        await tokenStorage.removeAuthToken();
        //await tokenStorage.removeRefreshToken();
        this.currentToken = null;
        this.instance = null;
    }

    private static signalAuthFailure() {
        // Emit auth event to notify the app about authentication failure
        authEvents.emit(AUTH_STATE_CHANGE, null);
    }


    static async call<T>(operation: (client: Client) => Promise<T>): Promise<T> {
        try {
            const client = await ApiClient.getInstance();
            return await operation(client);
        } catch (error: unknown) {
            // If the error is related to authentication and retries failed
            if (error instanceof ApiException)
            {
                if (error.status === 401) {
                    this.signalAuthFailure();
                    throw error;
                }
                if (error.status == 201) {
                    return;
                }
            }
            
            throw error;
        }
    }

    // Allow explicit reset of the client (useful after logout)
    static resetClient() {
        this.instance = null;
        this.currentToken = null;
    }
}