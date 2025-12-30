import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { ApiClient } from '../services/apiClient';
import { UserDto } from '../services/generated/generatedClient';
import { useMentionDropdown } from '../contexts/MentionContext';

interface MentionInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: any;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  autoFocus?: boolean;
}

export const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onChangeText,
  placeholder,
  style,
  multiline = true,
  numberOfLines = 4,
  maxLength,
  autoFocus = false,
}) => {
  const { theme } = useTheme();
  const { showDropdown, hideDropdown } = useMentionDropdown();
  const [friends, setFriends] = useState<UserDto[]>([]);
  const [filteredFriends, setFilteredFriends] = useState<UserDto[]>([]);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [mentionStart, setMentionStart] = useState<number>(-1);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const containerRef = useRef<View>(null);

  // Load friends list on mount
  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      const friendsList = await ApiClient.call(c => c.frenship_GetFriends());
      setFriends(friendsList);
    } catch (error) {
      // Silent fail
    }
  };

  // Handle text changes and detect @ mentions
  const handleTextChange = (text: string) => {
    onChangeText(text);

    // Find the last @ symbol before the cursor
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      // Check if there's a space or start of string before @
      const charBeforeAt = lastAtIndex > 0 ? text[lastAtIndex - 1] : ' ';
      const isValidMention = charBeforeAt === ' ' || lastAtIndex === 0;

      if (isValidMention) {
        const textAfterAt = text.substring(lastAtIndex + 1, cursorPosition);
        // Check if there's no space after @ (still typing the username)
        if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
          setMentionStart(lastAtIndex);
          filterFriends(textAfterAt);
          showDropdownAtPosition();
          return;
        }
      }
    }

    // No valid mention context, hide dropdown
    hideDropdown();
    setIsDropdownVisible(false);
    setMentionStart(-1);
  };

  // Filter friends based on search text
  const filterFriends = (searchText: string) => {
    if (searchText === '') {
      setFilteredFriends(friends.slice(0, 5)); // Show first 5 friends
    } else {
      const filtered = friends.filter(friend =>
        friend.name.toLowerCase().includes(searchText.toLowerCase())
      );
      setFilteredFriends(filtered.slice(0, 5)); // Show max 5 results
    }
  };

  // Show dropdown at input position
  const showDropdownAtPosition = () => {
    if (containerRef.current && filteredFriends.length > 0) {
      containerRef.current.measureInWindow((x, y, width, height) => {
        showDropdown({
          friends: filteredFriends,
          onSelect: handleSelectFriend,
          position: {
            top: y + height,
            left: x,
            width: width,
          },
        });
        setIsDropdownVisible(true);
      });
    }
  };

  // Handle friend selection from dropdown
  const handleSelectFriend = (friend: UserDto) => {
    if (mentionStart === -1) return;

    // Use the display name for the mention
    const displayName = friend.name;

    // Replace text from @ to cursor with @displayName
    const newText =
      value.substring(0, mentionStart) +
      `@${displayName} ` +
      value.substring(cursorPosition);

    onChangeText(newText);
    hideDropdown();
    setIsDropdownVisible(false);
    setMentionStart(-1);

    // Set cursor position after the inserted mention
    const newCursorPos = mentionStart + displayName.length + 2; // +2 for @ and space
    setTimeout(() => {
      setCursorPosition(newCursorPos);
      inputRef.current?.setNativeProps({
        selection: { start: newCursorPos, end: newCursorPos },
      });
    }, 10);
  };

  const handleSelectionChange = (event: any) => {
    setCursorPosition(event.nativeEvent.selection.start);
  };

  return (
    <View ref={containerRef} style={styles.container}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleTextChange}
        onSelectionChange={handleSelectionChange}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.backgroundAlt,
            color: theme.colors.textPrimary,
            borderColor: theme.colors.separator,
          },
          style,
        ]}
        multiline={multiline}
        numberOfLines={numberOfLines}
        maxLength={maxLength}
        autoFocus={autoFocus}
        textAlignVertical="top"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
  },
});
