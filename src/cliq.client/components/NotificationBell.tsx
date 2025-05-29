import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface NotificationBellProps {
    onPress: () => void;
    notificationCount?: number;
}

const NotificationBell: React.FC<NotificationBellProps> = ({
    onPress,
    notificationCount = 3 // Mock number for now
}) => {
    return (
        <TouchableOpacity style={styles.container} onPress={onPress}>
            <Ionicons name="notifications-outline" size={24} color="#1DA1F2" />
            {notificationCount > 0 && (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                        {notificationCount > 99 ? '99+' : notificationCount.toString()}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 8,
        position: 'relative',
    },
    badge: {
        position: 'absolute',
        top: 2,
        right: 2,
        backgroundColor: '#a230ff',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
});

export default NotificationBell;