import { useState, useEffect } from 'react';
import { AddUsersToCircleRequest, UserDto } from '../services/generated/generatedClient';
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

export function useAddUsersToCircle() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const addUsersToCircle = async (circleId: string, userIds: string[]) => {
        try {
            setIsLoading(true);
            setError(null);
            
            // Use ApiClient.call with a custom operation that makes the HTTP request
            await ApiClient.call(c => c.users(new AddUsersToCircleRequest({
                circleId: circleId,
                userIds: userIds
            })))

            return true;
        } catch (err) {
            console.log("Failed to add users to circle with err " + err);
            setError('Failed to add users to circle');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    return { addUsersToCircle, isLoading, error };
}
