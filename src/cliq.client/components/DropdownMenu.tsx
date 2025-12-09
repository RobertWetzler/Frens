import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';

export interface DropdownMenuItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
}

interface DropdownMenuProps {
  visible: boolean;
  onClose: () => void;
  items: DropdownMenuItem[];
  triggerButton?: React.ReactNode;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({ visible, onClose, items, triggerButton }) => {
  const { theme } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.menuContainer}>
      {triggerButton || (
        <TouchableOpacity
          style={styles.menuButton}
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>
      )}
      
      {visible && (
        <View style={styles.menuDropdown}>
          {items.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.menuItem,
                index === items.length - 1 && styles.lastMenuItem
              ]}
              activeOpacity={0.7}
              onPress={() => {
                item.onPress();
                onClose();
              }}
            >
              <Ionicons
                name={item.icon}
                size={16}
                color={item.destructive ? theme.colors.danger : theme.colors.textPrimary}
                style={styles.menuIcon}
              />
              <Text 
                style={[
                  styles.menuItemText,
                  item.destructive && styles.destructiveText
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const useStyles = makeStyles((theme) => ({
  menuContainer: {
    position: 'relative',
  },
  menuButton: {
    padding: 8,
  },
  menuDropdown: {
    position: 'absolute',
    top: 36,
    right: 0,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    minWidth: 150,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 20,
    borderWidth: 1,
    borderColor: theme.colors.separator,
    zIndex: 10000,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.separator,
    minHeight: 44,
    width: '100%',
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  menuIcon: {
    marginRight: 12,
  },
  menuItemText: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  destructiveText: {
    color: theme.colors.danger,
  },
}));

export default DropdownMenu;
