import { useState, useEffect } from 'react';
import { UserDto } from '../services/generated/generatedClient';
import { ApiClient } from '../services/apiClient';

export function useFriends() {
    const [friends, setFriends] = useState<UserDto[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadFriends = async () => {
            try {
              setIsLoading(true);
              const response = await ApiClient.call(c => c.frenship());
              // TODO: Use this to verify scrollability on mobile
              response.sort((u1, u2) => u1.name.localeCompare(u2.name));
              setFriends(response);
              setError(null);
            } catch (err) {
              setError('Failed to load friends. Please try again.');
              console.error('Error loading friends:', err);
            } finally {
              setIsLoading(false);
            }
    };

    useEffect(() => {
        loadFriends();
    }, []);

    return { friends, isLoading, error, loadFriends };
}