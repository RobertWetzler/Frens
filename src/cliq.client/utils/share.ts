import { Share } from "react-native";

export const handleShareProfile = async (userId: string) => {
    try {
        // Get the current domain from the browser URL if available, otherwise use default
        let baseUrl = 'https://frens-app.com'; // Default fallback for mobile apps

        if (typeof window !== 'undefined' && window.location) {
            // Running in a web browser - use current domain
            baseUrl = `${window.location.protocol}//${window.location.host}`;
        }
        const profileUrl = `${baseUrl}/profile/${userId}`;

        await Share.share({
            message: `Add me on Frens! ${profileUrl}`,
            url: profileUrl, // iOS will use this
            //title: 'My Frens Profile',
        });
    } catch (error) {
        console.error('Error sharing profile:', error);
    }
}