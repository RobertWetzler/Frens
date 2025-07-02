import { useState, useEffect } from 'react';
import { CirclePublicDto, CircleWithMembersDto } from '../services/generated/generatedClient';
import { ApiClient } from 'services/apiClient';

export function useMemberCircles() {
    const [circles, setCircles] = useState<CirclePublicDto[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadCircles = async () => {
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
    };

    useEffect(() => {
        loadCircles();
    }, []);

    return { circles, isLoading, error, loadCircles };
}

export function useCirclesWithMembers() {
    const [circles, setCircles] = useState<CircleWithMembersDto[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadCircles = async () => {
        try {
            setIsLoading(true);
            const circleList = await ApiClient.call(c => c.withMembers());
            setCircles(circleList);
            setError(null);
        } catch (err) {
            console.log("Failed to load Circles with members with err " + err)
            setError('Failed to load Circles with members');
            setCircles([]);
        } finally {
            setIsLoading(false);
        }
    };

    const deleteCircle = async (circleId: string) => {
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
    };

    useEffect(() => {
        loadCircles();
    }, []);

    return { circles, isLoading, error, loadCircles, deleteCircle };
}
