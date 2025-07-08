import { useState, useEffect, useCallback } from 'react';
import { CirclePublicDto, CircleWithMembersDto, UpdateUsersInCircleRequest } from '../services/generated/generatedClient';
import { ApiClient } from 'services/apiClient';

export function useMemberCircles() {
    const [circles, setCircles] = useState<CirclePublicDto[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadCircles = useCallback(async () => {
        try {
            setIsLoading(true);
            const circleList = await ApiClient.call(c => c.circleAll());
            setCircles(circleList);
            setError(null);
        } catch (err) {
            console.log("Failed to load Circles with err " + err)
            setError('Failed to load Circles');
            setCircles([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCircles();
    }, [loadCircles]);

    return { circles, isLoading, error, loadCircles };
}

export function useCirclesWithMembers() {
    const [circles, setCircles] = useState<CircleWithMembersDto[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isRemovingUser, setIsRemovingUser] = useState(false);
    const [isAddingUser, setIsAddingUser] = useState(false);

    const loadCircles = useCallback(async () => {
        try {
            setIsLoading(true);
            console.log('loadCircles: Starting API call...');
            const circleList = await ApiClient.call(c => c.withMembers());
            console.log('loadCircles: API call successful, received circles:', circleList);
            setCircles(circleList);
            setError(null);
        } catch (err) {
            console.log("Failed to load Circles with members with err " + err)
            setError('Failed to load Circles with members');
            setCircles([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const deleteCircle = useCallback(async (circleId: string) => {
        try {
            console.log('deleteCircle called with circleId:', circleId);
            await ApiClient.call(c => c.circleDELETE(circleId));
            console.log('API call successful, updating local state');
            // Remove the deleted circle from the local state
            setCircles(prevCircles => prevCircles.filter(circle => circle.id !== circleId));
            return true;
        } catch (err) {
            console.log("Failed to delete circle with err " + err);
            setError('Failed to delete circle');
            return false;
        }
    }, []);

    const removeUsersFromCircle = useCallback(async (circleId: string, userIds: string[]) => {
        try {
            setIsRemovingUser(true);
            setError(null);
            await ApiClient.call(c => c.usersDELETE(new UpdateUsersInCircleRequest({
                circleId: circleId,
                userIds: userIds
            })));
            console.log('removeUsersFromCircle called with circleId:', circleId, 'userIds:', userIds);
            
            // Update local state to remove the users from the circle
            setCircles(prevCircles => 
                prevCircles.map(circle => {
                    if (circle.id === circleId) {
                        return {
                            ...circle,
                            members: circle.members?.filter(member => !userIds.includes(member.id || '')) || []
                        };
                    }
                    return circle;
                })
            );
            return true;
        } catch (err) {
            console.log("Failed to remove users from circle with err " + err);
            setError('Failed to remove users from circle');
            return false;
        } finally {
            setIsRemovingUser(false);
        }
    }, []);

    const addUsersToCircle = useCallback(async (circleId: string, userIds: string[]) => {
        try {
            setIsAddingUser(true);
            setError(null);
            
            console.log('addUsersToCircle: Starting API call...');
            await ApiClient.call(c => c.usersPOST(new UpdateUsersInCircleRequest({
                circleId: circleId,
                userIds: userIds
            })));
            
            console.log('addUsersToCircle: API call successful, reloading circles...');
            
            // For adding users, we need to reload the circle data to get the complete user info
            // since we only have userIds, not the full user objects
            await loadCircles();
            console.log('addUsersToCircle: Circles reloaded successfully');
            return true;
        } catch (err) {
            console.log("Failed to add users to circle with err " + err);
            setError('Failed to add users to circle');
            return false;
        } finally {
            setIsAddingUser(false);
        }
    }, [loadCircles]);

    useEffect(() => {
        loadCircles();
    }, [loadCircles]);

    return { 
        circles, 
        isLoading, 
        error, 
        loadCircles, 
        deleteCircle, 
        removeUsersFromCircle,
        addUsersToCircle,
        isRemovingUser,
        isAddingUser
    };
}
