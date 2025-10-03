import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';

interface NotificationBellProps {
  onPress: () => void;
  notificationCount?: number;
  iconColor?: string;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ 
  onPress, 
  notificationCount = 3, // Mock number for now
  iconColor,
}) => {
  const { theme } = useTheme();
  const styles = useStyles();

  const handlePress = () => {
    onPress();
  };

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress}>
      <Ionicons name="notifications-outline" size={24} color={iconColor || theme.colors.primary} />
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

const useStyles = makeStyles((theme) => ({
  container: {
    padding: 8,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: theme.colors.card,
  },
  badgeText: {
    color: theme.colors.primaryContrast,
    fontSize: 12,
    fontWeight: 'bold',
  },
}));
export default NotificationBell;