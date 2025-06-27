import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAddNotifications } from '../hooks/useAddNotifications';

interface NotificationSubscribeButtonProps {
  applicationServerKey: string | ArrayBuffer;
  onSubscriptionChange?: (subscription: PushSubscription | null) => void;
  style?: any;
}

const NotificationSubscribeButton: React.FC<NotificationSubscribeButtonProps> = ({
  applicationServerKey,
  onSubscriptionChange,
  style
}) => {
  const { subscribe, isLoading, error, subscription, isSupported, hasExistingSubscription, isPWAInstalled } = useAddNotifications({
    applicationServerKey
  });

  const handlePress = async () => {
    const newSubscription = await subscribe();
    onSubscriptionChange?.(newSubscription);
  };

  // Don't render if not supported (web only)
  if (!isSupported) {
    return null;
  }

  // Don't render if not installed as PWA
  if (!isPWAInstalled) {
    return null;
  }

  // Don't render if already subscribed or has existing subscription
  if (subscription || hasExistingSubscription) {
    return null;
  }

  return (
    <TouchableOpacity 
      style={[styles.notificationButton, style]}
      onPress={handlePress}
      disabled={isLoading}
    >
      <Ionicons 
        name={isLoading ? "hourglass-outline" : "notifications-outline"} 
        size={20} 
        color="white" 
        style={styles.notificationIcon} 
      />
      <Text style={styles.notificationButtonText}>
        {isLoading ? 'Enabling...' : 'Enable notifications'}
      </Text>
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  notificationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8C66FF', // Orange color to differentiate from share button
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 25,
    shadowColor: '#8C66FF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  notificationIcon: {
    marginRight: 8,
  },
  notificationButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#ffcccc',
    fontSize: 12,
    marginLeft: 8,
  },
});

export default NotificationSubscribeButton;