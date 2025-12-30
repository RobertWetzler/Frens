import React, { createContext, useContext, useState, ReactNode } from 'react';
import { View, FlatList, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Avatar } from '@rneui/base';
import { UserDto } from '../services/generated/generatedClient';
import { useTheme } from '../theme/ThemeContext';

interface MentionDropdownData {
  friends: UserDto[];
  onSelect: (friend: UserDto) => void;
  position: { top: number; left: number; width: number };
}

interface MentionContextType {
  showDropdown: (data: MentionDropdownData) => void;
  hideDropdown: () => void;
}

const MentionContext = createContext<MentionContextType | undefined>(undefined);

export const useMentionDropdown = () => {
  const context = useContext(MentionContext);
  if (!context) {
    throw new Error('useMentionDropdown must be used within MentionProvider');
  }
  return context;
};

export const MentionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dropdownData, setDropdownData] = useState<MentionDropdownData | null>(null);
  const { theme } = useTheme();

  const showDropdown = (data: MentionDropdownData) => {
    setDropdownData(data);
  };

  const hideDropdown = () => {
    setDropdownData(null);
  };

  const handleSelectFriend = (friend: UserDto) => {
    if (dropdownData) {
      dropdownData.onSelect(friend);
      hideDropdown();
    }
  };

  const renderFriendItem = ({ item }: { item: UserDto }) => (
    <TouchableOpacity
      style={[styles.friendItem, { backgroundColor: theme.colors.card }]}
      onPress={() => handleSelectFriend(item)}
    >
      <Avatar
        rounded
        size="small"
        overlayContainerStyle={{ backgroundColor: theme.colors.accent }}
        title={item.name?.charAt(0).toUpperCase() || '?'}
      />
      <Text style={[styles.friendName, { color: theme.colors.textPrimary }]}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  return (
    <MentionContext.Provider value={{ showDropdown, hideDropdown }}>
      {children}
      {dropdownData && (
        <View
          style={[
            styles.dropdownContainer,
            {
              top: dropdownData.position.top,
              left: dropdownData.position.left,
              width: dropdownData.position.width,
            },
          ]}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.dropdown,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.separator,
              },
            ]}
            pointerEvents="auto"
          >
            <FlatList
              data={dropdownData.friends}
              renderItem={renderFriendItem}
              keyExtractor={item => item.id}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      )}
    </MentionContext.Provider>
  );
};

const styles = StyleSheet.create({
  dropdownContainer: {
    position: 'absolute',
    zIndex: 99999,
    elevation: 99999,
  },
  dropdown: {
    maxHeight: 250,
    borderWidth: 2,
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  friendName: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
  },
});
