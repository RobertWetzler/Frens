import { Client } from 'services/generated/generatedClient'
import { supabase } from 'services/supabase'
import getEnvVars from 'env'

export class ApiClient {
    private static instance: Client | null = null;
    private static currentToken: string | null = null;

    static async getInstance(): Promise<Client> {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token

        // If we have an instance and the token hasn't changed, return it
        if (this.instance && this.currentToken === token) {
            return this.instance;
        }

        const customFetch = {
            fetch: (url: RequestInfo, init?: RequestInit) => {
                return window.fetch(url, {
                    ...init,
                    headers: {
                        ...init?.headers,
                        'Authorization': `Bearer ${token}`
                    }
                })
            }
        }

        this.instance = new Client(getEnvVars('development').API_URL, customFetch);
        this.currentToken = token;
        return this.instance;
    }

    static async call<T>(operation: (client: Client) => Promise<T>): Promise<T> {
        const client = await ApiClient.getInstance();
        return operation(client);
    }
}