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
    <View style={[styles.container, style]}>
      <TouchableOpacity 
        style={styles.notificationButton}
        onPress={handlePress}
        disabled={isLoading}
      >
        <View style={styles.iconContainer}>
          <Ionicons 
            name={isLoading ? "hourglass-outline" : "notifications-outline"} 
            size={16} 
            color="#8C66FF" 
          />
        </View>
        <Text style={styles.notificationButtonText}>
          {isLoading ? 'Enabling notifications...' : 'Get notified of new posts'}
        </Text>
        <Ionicons 
          name="chevron-forward" 
          size={16} 
          color="#666" 
          style={styles.chevron}
        />
      </TouchableOpacity>
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  notificationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d6ebff',
    shadowColor: '#6699FF',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e6f3ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationButtonText: {
    color: '#333',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  chevron: {
    marginLeft: 8,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 12,
    marginTop: 8,
    marginLeft: 16,
  },
});

export default NotificationSubscribeButton;