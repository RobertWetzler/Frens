import React, { useEffect, useState } from 'react';
import { Text, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ApiClient } from '../services/apiClient';
import { UserDto } from '../services/generated/generatedClient';

interface MentionTextProps {
  text: string;
  style?: any;
}

export const MentionText: React.FC<MentionTextProps> = ({ text, style }) => {
  const navigation = useNavigation<any>();
  const [friends, setFriends] = useState<UserDto[]>([]);

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      const friendsList = await ApiClient.call(c => c.frenship_GetFriends());
      setFriends(friendsList as UserDto[]);
    } catch (error) {
      // Silent fail
    }
  };

  // Parse text and split into segments with mentions and links
  const parseText = (inputText: string) => {
    // Combined regex: mentions OR URLs
    // Mention: @ followed by a name (starting with uppercase)
    // URL: http(s):// or www. followed by non-space characters
    const combinedRegex = /(@[A-Z](?:[a-zA-Z0-9._-]|\s+[A-Z])*?)(?=\s+[a-z]|$|[.,!?;:])|(https?:\/\/[^\s]+)|(www\.[^\s]+)/g;
    const parts: { type: 'text' | 'mention' | 'link'; content: string; key: string }[] = [];
    let lastIndex = 0;
    let match;

    while ((match = combinedRegex.exec(inputText)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: inputText.substring(lastIndex, match.index),
          key: `text-${lastIndex}`,
        });
      }

      if (match[1]) {
        // It's a mention (group 1)
        const mentionName = match[1].substring(1); // Remove @
        parts.push({
          type: 'mention',
          content: mentionName,
          key: `mention-${match.index}`,
        });
      } else if (match[2] || match[3]) {
        // It's a URL (group 2 for http(s):// or group 3 for www.)
        const url = match[2] || match[3];
        parts.push({
          type: 'link',
          content: url,
          key: `link-${match.index}`,
        });
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after last mention
    if (lastIndex < inputText.length) {
      parts.push({
        type: 'text',
        content: inputText.substring(lastIndex),
        key: `text-${lastIndex}`,
      });
    }

    return parts.length > 0 ? parts : [{ type: 'text' as const, content: inputText, key: 'text-0' }];
  };

  const handleMentionPress = (displayName: string) => {
    // Find user by display name in friends list
    const user = friends.find(f => 
      f.name.toLowerCase() === displayName.toLowerCase()
    );

    if (user) {
      navigation.navigate('Profile', { userId: user.id });
    }
  };

  const handleLinkPress = async (url: string) => {
    // Add protocol if www. link
    const fullUrl = url.startsWith('www.') ? `https://${url}` : url;
    
    const canOpen = await Linking.canOpenURL(fullUrl);
    if (canOpen) {
      await Linking.openURL(fullUrl);
    }
  };

  const parts = parseText(text);

  return (
    <>
      {parts.map((part, index) => {
        if (part.type === 'mention') {
          return (
            <Text 
              key={part.key} 
              onPress={() => handleMentionPress(part.content)}
              style={[style, { color: '#60A5FA' }]}
            >
              @{part.content}
            </Text>
          );
        }
        if (part.type === 'link') {
          return (
            <Text 
              key={part.key} 
              onPress={() => handleLinkPress(part.content)}
              style={[style, { color: '#60A5FA', textDecorationLine: 'underline' }]}
            >
              {part.content}
            </Text>
          );
        }
        return <Text key={part.key} style={style}>{part.content}</Text>;
      })}
    </>
  );
};
