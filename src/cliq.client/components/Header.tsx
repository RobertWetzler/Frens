import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HeaderProps {
  title: string;
  onBackPress?: () => void;
  rightButton?: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  };
  rightActions?: React.ReactNode;
  showBackButton?: boolean;
  backButtonIcon?: keyof typeof Ionicons.glyphMap;
  titleAlign?: 'left' | 'center';
}

const Header: React.FC<HeaderProps> = ({
  title,
  onBackPress,
  rightButton,
  rightActions,
  showBackButton = true,
  backButtonIcon = 'arrow-back',
  titleAlign = 'center'
}) => {
  return (
    <View style={styles.header}>
      {showBackButton && onBackPress ? (
        <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
          <Ionicons name={backButtonIcon} size={24} color="#1DA1F2" />
        </TouchableOpacity>
      ) : titleAlign === 'center' ? (
        <View style={styles.backButton} />
      ) : null}
      
      <Text style={[
        styles.headerTitle, 
        { textAlign: titleAlign },
        titleAlign === 'left' && !showBackButton && styles.headerTitleLeftNoButton
      ]}>{title}</Text>
      
      <View style={styles.headerActions}>
        {rightButton && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              rightButton.disabled && styles.actionButtonDisabled
            ]}
            onPress={rightButton.onPress}
            disabled={rightButton.disabled}
          >
            <Text style={styles.actionButtonText}>{rightButton.label}</Text>
          </TouchableOpacity>
        )}
        {rightActions}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e4e8',
  },
  backButton: {
    padding: 8,
    minWidth: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  headerTitleLeftNoButton: {
    marginLeft: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 40,
    justifyContent: 'flex-end',
  },
  actionButton: {
    backgroundColor: '#1DA1F2',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  actionButtonDisabled: {
    backgroundColor: '#B8B8B8',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
});

export default Header;
