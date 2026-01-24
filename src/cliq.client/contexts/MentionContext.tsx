import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo } from 'react';
import { View, FlatList, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { MentionableUserDto } from '../services/generated/generatedClient';
import { useTheme } from '../theme/ThemeContext';
import { Avatar } from '../components/Avatar';

interface MentionDropdownData {
  users: MentionableUserDto[];
  onSelect: (user: MentionableUserDto) => void;
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

  const showDropdown = useCallback((data: MentionDropdownData) => {
    setDropdownData(data);
  }, []);

  const hideDropdown = useCallback(() => {
    setDropdownData(null);
  }, []);

  const contextValue = useMemo(() => ({ showDropdown, hideDropdown }), [showDropdown, hideDropdown]);

  const handleSelectUser = useCallback((user: MentionableUserDto) => {
    if (dropdownData) {
      dropdownData.onSelect(user);
      setDropdownData(null);
    }
  }, [dropdownData]);

  const renderUserItem = ({ item }: { item: MentionableUserDto }) => (
    <TouchableOpacity
      style={[styles.userItem, { backgroundColor: theme.colors.card }]}
      onPress={() => handleSelectUser(item)}
    >
      <Avatar
        name={item.name || '?'}
        userId={item.id}
        imageUrl={item.profilePictureUrl ?? undefined}
        simple
        size={32}
      />
      <Text style={[styles.userName, { color: theme.colors.textPrimary }]}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  return (
    <MentionContext.Provider value={contextValue}>
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
              data={dropdownData.users}
              renderItem={renderUserItem}
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
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  userName: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
  },
});
