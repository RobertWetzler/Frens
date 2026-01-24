import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { MentionableUserDto, MentionDto } from '../services/generated/generatedClient';
import { useMentionDropdown } from '../contexts/MentionContext';

interface MentionInputProps {
  value: string;
  onChangeText: (text: string) => void;
  /** List of users that can be mentioned */
  mentionableUsers?: MentionableUserDto[];
  /** Callback when mentions change (for tracking mention positions) */
  onMentionsChange?: (mentions: MentionDto[]) => void;
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
  mentionableUsers = [],
  onMentionsChange,
  placeholder,
  style,
  multiline = true,
  numberOfLines = 4,
  maxLength,
  autoFocus = false,
}) => {
  const { theme } = useTheme();
  const { showDropdown, hideDropdown } = useMentionDropdown();
  const [filteredUsers, setFilteredUsers] = useState<MentionableUserDto[]>([]);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [mentionStart, setMentionStart] = useState<number>(-1);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentions, setMentions] = useState<MentionDto[]>([]);
  const inputRef = useRef<TextInput>(null);
  const containerRef = useRef<View>(null);
  // Use refs for values needed in callbacks to avoid stale closure issues
  const mentionStartRef = useRef<number>(-1);
  const cursorPositionRef = useRef<number>(0);
  const valueRef = useRef<string>(value);

  // Keep refs in sync
  useEffect(() => {
    mentionStartRef.current = mentionStart;
  }, [mentionStart]);
  useEffect(() => {
    cursorPositionRef.current = cursorPosition;
  }, [cursorPosition]);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Clean up dropdown when component unmounts (e.g., navigating away)
  useEffect(() => {
    return () => {
      hideDropdown();
    };
    // hideDropdown is stable (memoized in context), safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update parent when mentions change
  useEffect(() => {
    onMentionsChange?.(mentions);
  }, [mentions, onMentionsChange]);

  // Handle text changes and detect @ mentions
  const handleTextChange = (text: string) => {
    // Adjust mention positions if text was modified before them
    const lengthDiff = text.length - value.length;
    if (lengthDiff !== 0 && mentions.length > 0) {
      const adjustedMentions = mentions
        .map(m => {
          // If modification was before this mention, adjust position
          if (cursorPosition <= m.start) {
            return new MentionDto({
              ...m,
              start: m.start + lengthDiff,
              end: m.end + lengthDiff,
            });
          }
          // If modification was inside this mention, invalidate it
          if (cursorPosition > m.start && cursorPosition <= m.end) {
            return null;
          }
          return m;
        })
        .filter((m): m is MentionDto => m !== null);
      setMentions(adjustedMentions);
    }

    onChangeText(text);

    // Find the last @ symbol before the cursor
    const newCursorPos = cursorPosition + lengthDiff;
    const textBeforeCursor = text.substring(0, newCursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      // Check if there's a space or start of string before @
      const charBeforeAt = lastAtIndex > 0 ? text[lastAtIndex - 1] : ' ';
      const isValidMention = charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtIndex === 0;

      if (isValidMention) {
        const textAfterAt = text.substring(lastAtIndex + 1, newCursorPos);
        // Check if there's no space after @ (still typing the username)
        if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
          // Update both state and ref immediately
          setMentionStart(lastAtIndex);
          mentionStartRef.current = lastAtIndex;
          // Filter and show dropdown in one operation to avoid stale state
          const filtered = filterUsersImmediate(textAfterAt);
          showDropdownWithUsers(filtered);
          return;
        }
      }
    }

    // No valid mention context, hide dropdown
    hideDropdown();
    setIsDropdownVisible(false);
    setMentionStart(-1);
  };

  // Filter mentionable users based on search text - returns result immediately
  const filterUsersImmediate = (searchText: string): MentionableUserDto[] => {
    let filtered: MentionableUserDto[];
    if (searchText === '') {
      filtered = mentionableUsers.slice(0, 5);
    } else {
      filtered = mentionableUsers.filter(user =>
        user.name?.toLowerCase().includes(searchText.toLowerCase())
      ).slice(0, 5);
    }
    setFilteredUsers(filtered);
    return filtered;
  };

  // Show dropdown at input position with the given users
  const showDropdownWithUsers = (users: MentionableUserDto[]) => {
    if (containerRef.current && users.length > 0) {
      containerRef.current.measureInWindow((x, y, width, height) => {
        showDropdown({
          users: users,
          onSelect: handleSelectUser,
          position: {
            top: y + height,
            left: x,
            width: width,
          },
        });
        setIsDropdownVisible(true);
      });
    } else if (users.length === 0) {
      // No users to show, hide dropdown
      hideDropdown();
      setIsDropdownVisible(false);
    }
  };

  // Handle user selection from dropdown
  const handleSelectUser = (user: MentionableUserDto) => {
    // Use refs to get current values (avoids stale closure)
    const currentMentionStart = mentionStartRef.current;
    const currentCursorPosition = cursorPositionRef.current;
    const currentValue = valueRef.current;

    if (currentMentionStart === -1) return;

    const selectedUser = mentionableUsers.find(u => u.id === user.id);
    if (!selectedUser) return;

    const displayName = selectedUser.name || '';
    const mentionEnd = currentMentionStart + displayName.length + 1; // +1 for @

    // Replace text from @ to cursor with @displayName
    const newText =
      currentValue.substring(0, currentMentionStart) +
      `@${displayName} ` +
      currentValue.substring(currentCursorPosition);

    // Track this mention
    const newMention = new MentionDto({
      userId: selectedUser.id,
      name: displayName,
      start: currentMentionStart,
      end: mentionEnd,
    });

    setMentions(prev => [...prev, newMention]);
    onChangeText(newText);
    hideDropdown();
    setIsDropdownVisible(false);
    setMentionStart(-1);
    mentionStartRef.current = -1;

    // Set cursor position after the inserted mention
    const newCursorPos = mentionEnd + 1; // +1 for space
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
