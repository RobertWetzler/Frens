import { useState, useEffect } from 'react';
import { CirclePublicDto } from '../services/generated/generatedClient';
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
