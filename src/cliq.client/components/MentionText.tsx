import React from 'react';
import { Text, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MentionDto } from '../services/generated/generatedClient';

interface MentionTextProps {
  text: string;
  style?: any;
  mentions?: MentionDto[];
}

type TextPart = {
  type: 'text' | 'mention' | 'link';
  content: string;
  key: string;
  userId?: string;
};

export const MentionText: React.FC<MentionTextProps> = ({ text, style, mentions = [] }) => {
  const navigation = useNavigation<any>();

  // Parse text and split into segments with mentions (from data) and links (detected)
  const parseText = (inputText: string): TextPart[] => {
    // Sort mentions by start position
    const sortedMentions = [...mentions].sort((a, b) => a.start - b.end);
    
    // First, find all URLs in the text
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/g;
    const urls: { start: number; end: number; content: string }[] = [];
    let urlMatch;
    while ((urlMatch = urlRegex.exec(inputText)) !== null) {
      urls.push({
        start: urlMatch.index,
        end: urlMatch.index + urlMatch[0].length,
        content: urlMatch[0],
      });
    }

    // Combine mentions and URLs into a single list of "special" segments
    const segments: { type: 'mention' | 'link'; start: number; end: number; content: string; userId?: string }[] = [];
    
    // Add mentions (they include the @ symbol in text, so start is at @)
    for (const mention of sortedMentions) {
      segments.push({
        type: 'mention',
        start: mention.start,
        end: mention.end,
        content: mention.name,
        userId: mention.userId,
      });
    }
    
    // Add URLs that don't overlap with mentions
    for (const url of urls) {
      const overlapsWithMention = segments.some(
        s => s.type === 'mention' && url.start < s.end && url.end > s.start
      );
      if (!overlapsWithMention) {
        segments.push({
          type: 'link',
          start: url.start,
          end: url.end,
          content: url.content,
        });
      }
    }

    // Sort all segments by start position
    segments.sort((a, b) => a.start - b.start);

    // Build the parts array
    const parts: TextPart[] = [];
    let lastIndex = 0;

    for (const segment of segments) {
      // Add text before this segment
      if (segment.start > lastIndex) {
        parts.push({
          type: 'text',
          content: inputText.substring(lastIndex, segment.start),
          key: `text-${lastIndex}`,
        });
      }

      if (segment.type === 'mention') {
        // The text from start to end should be "@Name"
        parts.push({
          type: 'mention',
          content: segment.content,
          key: `mention-${segment.start}`,
          userId: segment.userId,
        });
      } else {
        parts.push({
          type: 'link',
          content: segment.content,
          key: `link-${segment.start}`,
        });
      }

      lastIndex = segment.end;
    }

    // Add remaining text after last segment
    if (lastIndex < inputText.length) {
      parts.push({
        type: 'text',
        content: inputText.substring(lastIndex),
        key: `text-${lastIndex}`,
      });
    }

    return parts.length > 0 ? parts : [{ type: 'text', content: inputText, key: 'text-0' }];
  };

  const handleMentionPress = (userId: string | undefined) => {
    if (userId) {
      navigation.navigate('Profile', { userId });
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
      {parts.map((part) => {
        if (part.type === 'mention') {
          return (
            <Text 
              key={part.key} 
              onPress={() => handleMentionPress(part.userId)}
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
