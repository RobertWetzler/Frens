import React, { useMemo, useState } from 'react';
import { ApiClient } from 'services/apiClient';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useCreatePostData } from 'hooks/useCircle';
import ShaderBackground from 'components/ShaderBackground';
import { CreateEventDto, FollowInterestRequest, MentionDto, MentionableUserDto } from 'services/generated/generatedClient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useFocusEffect } from '@react-navigation/native';
import Header from 'components/Header';
import { MentionInput } from 'components/MentionInput';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';
import { feedEvents, FEED_POST_CREATED, FEED_POST_STATUS_UPDATED, OptimisticPost } from 'hooks/feedEvents';
import AudiencePickerSheet from 'components/AudiencePickerSheet';


const CreatePostScreen = ({ navigation, route }) => {
  const { theme } = useTheme();
  const styles = useStyles();
  const [postContent, setPostContent] = useState('');
  const [selectedCircleIds, setSelectedCircleIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<{ name: string; displayName: string }[]>([]);
  const [mentions, setMentions] = useState<MentionDto[]>([]);
  const [asEvent, setAsEvent] = useState(false);
  const [images, setImages] = useState<Array<{ uri: string; fileName: string; type: string; size?: number; webFile?: File }>>([]);
  const [eventTitle, setEventTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const { circles, friends, followedInterests, suggestedInterests, isLoading, error, loadData } = useCreatePostData();
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Compute mentionable users from selected circles
  const mentionableUsers = useMemo<MentionableUserDto[]>(() => {
    const userMap = new Map<string, MentionableUserDto>();
    for (const circleId of selectedCircleIds) {
      const circle = circles.find(c => c.id === circleId);
      if (circle?.mentionableUsers) {
        for (const user of circle.mentionableUsers) {
          if (!userMap.has(user.id)) {
            userMap.set(user.id, user);
          }
        }
      }
    }
    return Array.from(userMap.values());
  }, [selectedCircleIds, circles]);

  // For refreshing data when this screen is navigated to
  useFocusEffect(
    React.useCallback(() => {
      if (route.params?.refresh) {
        loadData();
        navigation.setParams({ refresh: undefined });
      }
    }, [route.params?.refresh])
  );

  // NOTE: Defer loading/error early returns until after all hooks to preserve hook order

  const toggleCircleSelection = (circleId: string) => {
    setSelectedCircleIds(prev =>
      prev.includes(circleId)
        ? prev.filter(id => id !== circleId)
        : [...prev, circleId]
    );
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleInterestSelection = (name: string, displayName: string) => {
    setSelectedInterests(prev => {
      const exists = prev.some(i => i.name === name);
      if (exists) {
        return prev.filter(i => i.name !== name);
      }
      return [...prev, { name, displayName }];
    });
  };

  const hasAudience = selectedCircleIds.length > 0 || selectedUserIds.length > 0;

  const isPostValid = () => {
    return (postContent.trim() || images.length > 0) && hasAudience;
  };

  const isEventValid = useMemo(() => {
    if (!asEvent) return false;
    if (!eventTitle.trim()) return false;
    if (!startDate.match(/^\d{4}-\d{2}-\d{2}$/)) return false;
    if (!startTime.match(/^\d{2}:\d{2}$/)) return false;
    const anyEnd = endDate.trim().length > 0 || endTime.trim().length > 0;
    if (anyEnd && (!endDate.match(/^\d{4}-\d{2}-\d{2}$/) || !endTime.match(/^\d{2}:\d{2}$/))) return false;
    if (!hasAudience) return false;
    return true;
  }, [asEvent, eventTitle, startDate, startTime, endDate, endTime, hasAudience]);

  // Render loading state (after hooks)
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size={36} color={theme.colors.primary} />
      </SafeAreaView>
    );
  }
  // Render error state (after hooks)
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <ShaderBackground />
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  const parseDateTime = (dateStr: string, timeStr: string): Date | null => {
    if (!dateStr || !timeStr) return null;
    const iso = `${dateStr}T${timeStr}:00`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  };

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const toTimeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setFormError(null);

    const MAX_TOTAL_IMAGES_BYTES = 50 * 1024 * 1024;
    if (!asEvent && images.length > 0) {
      const totalBytes = images.reduce((sum, img) => sum + (img.size || 0), 0);
      if (totalBytes > MAX_TOTAL_IMAGES_BYTES) {
        setFormError('Images exceed 50 MB total. Please remove some and try again.');
        return;
      }
    }

    if (asEvent) {
      if (!isEventValid) return;
      const start = parseDateTime(startDate, startTime);
      if (!start) {
        setFormError('Enter a valid start date and time (YYYY-MM-DD, HH:mm).');
        return;
      }
      let end: Date | undefined = undefined;
      if (endDate || endTime) {
        const parsedEnd = parseDateTime(endDate, endTime);
        if (!parsedEnd) {
          setFormError('Enter a valid end date and time (YYYY-MM-DD, HH:mm), or clear both.');
          return;
        }
        if (parsedEnd.getTime() <= start.getTime()) {
          setFormError('End must be after start.');
          return;
        }
        end = parsedEnd;
      }

      setIsSubmitting(true);

      const optimisticId = `optimistic-${Date.now()}-${Math.random()}`;
      const optimisticEvent: OptimisticPost = {
        id: optimisticId,
        text: postContent.trim(),
        date: new Date(),
        user: { id: '', name: 'You', email: '' },
        sharedWithCircles: circles.filter(c => selectedCircleIds.includes(c.id)),
        commentCount: 0,
        hasImage: false,
        _optimisticId: optimisticId,
        _status: 'pending',
        _discriminator: 'Event',
        title: eventTitle.trim(),
        startDateTime: start,
        endDateTime: end,
        isEvent: true,
      } as any;

      feedEvents.emit(FEED_POST_CREATED, optimisticEvent);

      const capturedContent = postContent.trim();
      const capturedTitle = eventTitle.trim();
      const capturedCircleIds = [...selectedCircleIds];
      const capturedUserIds = [...selectedUserIds];
      setPostContent('');
      setSelectedCircleIds([]);
      setSelectedUserIds([]);
      setSelectedInterests([]);
      setEventTitle('');
      setStartDate('');
      setStartTime('');
      setEndDate('');
      setEndTime('');
      setAsEvent(false);
      setIsSubmitting(false);
      navigation.goBack();

      try {
        const response = await ApiClient.call(c =>
          c.event_CreateEvent(new CreateEventDto({
            title: capturedTitle,
            text: capturedContent,
            startDateTime: start,
            endDateTime: end,
            circleIds: capturedCircleIds,
          }))
        );
        feedEvents.emit(FEED_POST_STATUS_UPDATED, {
          optimisticId,
          status: 'posted',
          actualPost: response,
        });
      } catch (error) {
        console.error('Error creating event:', error);
        feedEvents.emit(FEED_POST_STATUS_UPDATED, {
          optimisticId,
          status: 'failed',
          error: 'Failed to create event',
        });
      }
      return;
    }

    // Normal post
    if (!isPostValid()) return;
    setIsSubmitting(true);

    const optimisticId = `optimistic-${Date.now()}-${Math.random()}`;
    const optimisticPost: OptimisticPost = {
      id: optimisticId,
      text: postContent.trim() || '',
      date: new Date(),
      user: { id: '', name: 'You', email: '' },
      sharedWithCircles: circles.filter(c => selectedCircleIds.includes(c.id)),
      commentCount: 0,
      hasImage: images.length > 0,
      _optimisticId: optimisticId,
      _status: 'pending',
      _localImages: images.map(img => ({ uri: img.uri, fileName: img.fileName, type: img.type, webFile: img.webFile })),
    } as any as OptimisticPost;

    feedEvents.emit(FEED_POST_CREATED, optimisticPost);

    const capturedContent = postContent.trim() || null;
    const capturedCircleIds = [...selectedCircleIds];
    const capturedUserIds = [...selectedUserIds];
    const capturedImages = [...images];
    const capturedMentions = [...mentions];
    const capturedInterestNames = selectedInterests.map(i => i.name);
    setPostContent('');
    setSelectedCircleIds([]);
    setSelectedUserIds([]);
    setSelectedInterests([]);
    setImages([]);
    setMentions([]);
    setIsSubmitting(false);
    navigation.goBack();

    try {
      const fileParams = capturedImages.map(img => ({
        data: Platform.OS === 'web' ? (img.webFile as any) : { uri: img.uri, name: img.fileName, type: img.type },
        fileName: img.fileName,
      }));
      const mentionsJson = capturedMentions.length > 0 ? JSON.stringify(capturedMentions) : null;
      const response = await ApiClient.call(c =>
        c.post_CreatePost(
          capturedContent,
          capturedCircleIds,
          capturedUserIds,
          capturedInterestNames.length > 0 ? capturedInterestNames : null,
          false, // announceNewInterests
          fileParams,
          mentionsJson,
        )
      );
      feedEvents.emit(FEED_POST_STATUS_UPDATED, {
        optimisticId,
        status: 'posted',
        actualPost: response,
      });
    } catch (error) {
      console.error('Error submitting post:', error);
      feedEvents.emit(FEED_POST_STATUS_UPDATED, {
        optimisticId,
        status: 'failed',
        error: 'Failed to create post',
      });
    }
  };

  const handleCreateNewCircle = () => {
    setIsPickerVisible(false);
    navigation.navigate('CreateCircle', {
      onReturn: () => navigation.setParams({ refresh: true })
    });
  };

  const handleCreateInterest = async (name: string) => {
    const result = await ApiClient.call(c =>
      c.interest_FollowInterest(name, new FollowInterestRequest({ displayName: name }))
    );
    // Add the newly created interest to the selection
    setSelectedInterests(prev => {
      if (prev.some(i => i.name === result.name)) return prev;
      return [...prev, { name: result.name!, displayName: result.displayName! }];
    });
    // Refresh data so the new interest appears in the list
    loadData();
  };

  // Build the audience chip list for rendering
  const audienceChips: { key: string; label: string; type: 'circle' | 'friend' | 'interest'; onRemove: () => void }[] = [
    ...selectedCircleIds.map(id => {
      const circle = circles.find(c => c.id === id);
      return {
        key: `c-${id}`,
        label: circle?.name || 'Circle',
        type: 'circle' as const,
        onRemove: () => toggleCircleSelection(id),
      };
    }),
    ...selectedUserIds.map(id => {
      const friend = friends.find(f => f.id === id);
      return {
        key: `u-${id}`,
        label: friend?.name || 'Friend',
        type: 'friend' as const,
        onRemove: () => toggleUserSelection(id),
      };
    }),
    ...selectedInterests.map(i => ({
      key: `i-${i.name}`,
      label: `#${i.displayName}`,
      type: 'interest' as const,
      onRemove: () => toggleInterestSelection(i.name, i.displayName),
    })),
  ];

  const totalAudience = selectedCircleIds.length + selectedUserIds.length + selectedInterests.length;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <Header
          title={asEvent ? 'Create Event' : 'Create Post'}
          onBackPress={() => navigation.goBack()}
          backButtonIcon="close"
          rightButton={{
            label: asEvent ? 'Create' : 'Post',
            onPress: handleSubmit,
            disabled: isSubmitting || (asEvent ? !isEventValid : !isPostValid())
          }}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Text input */}
          <MentionInput
            value={postContent}
            onChangeText={setPostContent}
            placeholder={asEvent ? "What's this event about? (optional details)" : "What's boopping?"}
            style={styles.input}
            multiline
            numberOfLines={6}
            maxLength={1000}
            autoFocus
            mentionableUsers={mentionableUsers}
            onMentionsChange={setMentions}
          />

          {/* Toolbar row: Photos + Event toggle */}
          <View style={styles.toolbar}>
            {!asEvent && (
              Platform.OS === 'web' ? (
                <>
                  <input
                    multiple
                    accept="image/*"
                    style={{ display: 'none' }}
                    id="post-image-input"
                    type="file"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      const mapped = files.map(f => ({ uri: URL.createObjectURL(f), fileName: f.name, type: f.type || 'image/jpeg', webFile: f, size: f.size }));
                      setImages(prev => [...prev, ...mapped]);
                      e.target.value = '';
                    }}
                  />
                  <TouchableOpacity
                    style={styles.toolbarButton}
                    onPress={() => (document.getElementById('post-image-input') as HTMLInputElement)?.click()}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="image-outline" size={20} color={theme.colors.primary} />
                    <Text style={styles.toolbarButtonText}>
                      {images.length > 0 ? `${images.length} photo${images.length > 1 ? 's' : ''}` : 'Photos'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.toolbarButton}
                  onPress={async () => {
                    try {
                      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                      if (perm.status !== 'granted') return;
                      const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
                      if (result.canceled) return;
                      const assets = result.assets || [];
                      const sized = await Promise.all(
                        assets.map(async (a) => {
                          let size: number | undefined = undefined;
                          try {
                            const info = await FileSystem.getInfoAsync(a.uri);
                            if (info.exists && typeof info.size === 'number') size = info.size;
                          } catch {}
                          return { uri: a.uri, fileName: a.fileName || `photo-${Date.now()}.jpg`, type: a.mimeType || 'image/jpeg', size };
                        })
                      );
                      setImages(prev => [...prev, ...sized]);
                    } catch (e) { console.warn('Image pick error', e); }
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="image-outline" size={20} color={theme.colors.primary} />
                  <Text style={styles.toolbarButtonText}>
                    {images.length > 0 ? `${images.length} photo${images.length > 1 ? 's' : ''}` : 'Photos'}
                  </Text>
                </TouchableOpacity>
              )
            )}

            <TouchableOpacity
              style={[styles.toolbarButton, asEvent && styles.toolbarButtonActive]}
              onPress={() => setAsEvent(!asEvent)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={asEvent ? 'calendar' : 'calendar-outline'}
                size={20}
                color={asEvent ? theme.colors.primaryContrast : theme.colors.primary}
              />
              <Text style={[styles.toolbarButtonText, asEvent && styles.toolbarButtonTextActive]}>
                Event
              </Text>
            </TouchableOpacity>
          </View>

          {/* Image thumbnails */}
          {images.length > 0 && !asEvent && (
            <View style={styles.thumbRow}>
              <FlatList
                horizontal
                data={images}
                keyExtractor={(item) => item.uri}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item, index }) => (
                  <View style={styles.thumbWrapper}>
                    <Image source={{ uri: item.uri }} style={styles.thumbImage} />
                    <TouchableOpacity
                      onPress={() => setImages(prev => prev.filter((_, i) => i !== index))}
                      style={styles.removeThumb}
                      accessibilityRole="button"
                      accessibilityLabel="Remove image"
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close" size={14} color={theme.colors.primaryContrast} />
                    </TouchableOpacity>
                  </View>
                )}
                contentContainerStyle={styles.thumbList}
              />
            </View>
          )}

          {/* Event form fields */}
          {asEvent && (
            <View style={styles.eventForm}>
              <Text style={styles.formLabel}>Title</Text>
              <TextInput
                style={styles.inputField}
                placeholder="Event title"
                value={eventTitle}
                onChangeText={setEventTitle}
                placeholderTextColor={theme.colors.inputPlaceholder}
              />

              <Text style={[styles.formLabel, { marginTop: 10 }]}>Start</Text>
              <View style={styles.row}>
                {Platform.OS === 'web' ? (
                  <View style={[styles.inputField, styles.rowItem]}>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate((e.target as HTMLInputElement).value)}
                      style={{
                        width: '100%', background: 'transparent', border: 'none', outline: 'none',
                        fontSize: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
                        color: theme.colors.textPrimary, padding: 0, margin: 0, lineHeight: 'normal',
                      }}
                    />
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.inputField, styles.rowItem, styles.inputButton]}
                    onPress={() => setShowStartDatePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text>{startDate || 'YYYY-MM-DD'}</Text>
                  </TouchableOpacity>
                )}

                {Platform.OS === 'web' ? (
                  <View style={[styles.inputField, styles.rowItem]}>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime((e.target as HTMLInputElement).value)}
                      style={{
                        width: '100%', background: 'transparent', border: 'none', outline: 'none',
                        fontSize: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
                        color: theme.colors.textPrimary, padding: 0, margin: 0, lineHeight: 'normal',
                      }}
                    />
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.inputField, styles.rowItem, styles.inputButton]}
                    onPress={() => setShowStartTimePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text>{startTime || 'HH:mm'}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {showStartDatePicker && Platform.OS !== 'web' && (
                <DateTimePicker
                  value={startDate ? new Date(`${startDate}T${startTime || '00:00'}:00`) : new Date()}
                  mode="date"
                  display="default"
                  onChange={(event: any, selected?: Date) => {
                    setShowStartDatePicker(false);
                    if (event?.type === 'dismissed') return;
                    if (selected) setStartDate(toDateStr(selected));
                  }}
                />
              )}
              {showStartTimePicker && Platform.OS !== 'web' && (
                <DateTimePicker
                  value={startDate ? new Date(`${startDate}T${startTime || '00:00'}:00`) : new Date()}
                  mode="time"
                  display="default"
                  onChange={(event: any, selected?: Date) => {
                    setShowStartTimePicker(false);
                    if (event?.type === 'dismissed') return;
                    if (selected) setStartTime(toTimeStr(selected));
                  }}
                />
              )}

              <Text style={[styles.formLabel, { marginTop: 10 }]}>End (optional)</Text>
              <View style={styles.row}>
                {Platform.OS === 'web' ? (
                  <View style={[styles.inputField, styles.rowItem]}>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate((e.target as HTMLInputElement).value)}
                      style={{
                        width: '100%', background: 'transparent', border: 'none', outline: 'none',
                        fontSize: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
                        color: theme.colors.textPrimary, padding: 0, margin: 0, lineHeight: 'normal',
                      }}
                    />
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.inputField, styles.rowItem, styles.inputButton]}
                    onPress={() => setShowEndDatePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text>{endDate || 'YYYY-MM-DD'}</Text>
                  </TouchableOpacity>
                )}

                {Platform.OS === 'web' ? (
                  <View style={[styles.inputField, styles.rowItem]}>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime((e.target as HTMLInputElement).value)}
                      style={{
                        width: '100%', background: 'transparent', border: 'none', outline: 'none',
                        fontSize: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
                        color: theme.colors.textPrimary, padding: 0, margin: 0, lineHeight: 'normal',
                      }}
                    />
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.inputField, styles.rowItem, styles.inputButton]}
                    onPress={() => setShowEndTimePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text>{endTime || 'HH:mm'}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {showEndDatePicker && Platform.OS !== 'web' && (
                <DateTimePicker
                  value={endDate ? new Date(`${endDate}T${endTime || '00:00'}:00`) : new Date()}
                  mode="date"
                  display="default"
                  onChange={(event: any, selected?: Date) => {
                    setShowEndDatePicker(false);
                    if (event?.type === 'dismissed') return;
                    if (selected) setEndDate(toDateStr(selected));
                  }}
                />
              )}
              {showEndTimePicker && Platform.OS !== 'web' && (
                <DateTimePicker
                  value={endDate ? new Date(`${endDate}T${endTime || '00:00'}:00`) : new Date()}
                  mode="time"
                  display="default"
                  onChange={(event: any, selected?: Date) => {
                    setShowEndTimePicker(false);
                    if (event?.type === 'dismissed') return;
                    if (selected) setEndTime(toTimeStr(selected));
                  }}
                />
              )}
            </View>
          )}

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          {/* ─── Audience section ─── */}
          <View style={styles.audienceSection}>
            <View style={styles.audienceLabelRow}>
              <Ionicons name="send-outline" size={16} color={theme.colors.textSecondary} />
              <Text style={styles.audienceLabel}>To</Text>
            </View>

            {/* Chips for selected audiences */}
            <View style={styles.chipContainer}>
              {audienceChips.map(chip => (
                <View
                  key={chip.key}
                  style={[
                    styles.chip,
                    chip.type === 'circle' && styles.chipCircle,
                    chip.type === 'friend' && styles.chipFriend,
                    chip.type === 'interest' && styles.chipInterest,
                  ]}
                >
                  <Text style={styles.chipText} numberOfLines={1}>{chip.label}</Text>
                  <TouchableOpacity
                    onPress={chip.onRemove}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    style={styles.chipRemove}
                  >
                    <Ionicons name="close" size={14} color={theme.colors.primaryContrast} />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add button */}
              <TouchableOpacity
                style={styles.addAudienceButton}
                onPress={() => setIsPickerVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={18} color={theme.colors.primary} />
                <Text style={styles.addAudienceText}>
                  {totalAudience === 0 ? 'Choose audience' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Validation warning */}
            {!hasAudience && (
              <Text style={styles.audienceWarning}>
                Select at least one circle or friend to share with
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Audience picker modal */}
      <AudiencePickerSheet
        visible={isPickerVisible}
        onClose={() => setIsPickerVisible(false)}
        circles={circles}
        friends={friends}
        followedInterests={followedInterests}
        suggestedInterests={suggestedInterests}
        selectedCircleIds={selectedCircleIds}
        selectedUserIds={selectedUserIds}
        selectedInterestNames={selectedInterests.map(i => i.name)}
        onToggleCircle={toggleCircleSelection}
        onToggleFriend={toggleUserSelection}
        onToggleInterest={toggleInterestSelection}
        onCreateCircle={handleCreateNewCircle}
        onCreateInterest={handleCreateInterest}
      />
    </SafeAreaView>
  );
};

const useStyles = makeStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundAlt,
  },
  errorText: {
    color: theme.colors.danger,
    textAlign: 'center',
    marginTop: 20,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  input: {
    padding: 20,
    fontSize: 18,
    textAlignVertical: 'top',
    minHeight: 120,
    backgroundColor: theme.colors.card,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: 12,
  },
  toolbar: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 8,
    gap: 8,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    gap: 6,
  },
  toolbarButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  toolbarButtonText: {
    color: theme.colors.primary,
    fontWeight: '500',
    fontSize: 14,
  },
  toolbarButtonTextActive: {
    color: theme.colors.primaryContrast,
  },
  thumbRow: {
    paddingTop: 4,
    paddingHorizontal: 15,
  },
  thumbList: {
    gap: 8,
  },
  thumbWrapper: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 8,
    backgroundColor: theme.colors.card,
    position: 'relative',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  removeThumb: {
    position: 'absolute',
    top: 3,
    right: 3,
    backgroundColor: theme.colors.primary,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  eventForm: {
    paddingHorizontal: 15,
    paddingTop: 4,
  },
  formLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  inputField: {
    backgroundColor: theme.colors.card,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    color: theme.colors.textPrimary,
  },
  inputButton: {
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  rowItem: {
    flex: 1,
  },
  formError: {
    color: theme.colors.danger,
    marginTop: 8,
    marginHorizontal: 15,
    fontSize: 13,
  },
  audienceSection: {
    marginHorizontal: 15,
    marginTop: 12,
    padding: 14,
    backgroundColor: theme.colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
  },
  audienceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  audienceLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 6,
    borderRadius: 16,
    maxWidth: '80%',
  },
  chipCircle: {
    backgroundColor: theme.colors.primary,
  },
  chipFriend: {
    backgroundColor: theme.colors.accent || theme.colors.primary,
  },
  chipInterest: {
    backgroundColor: (theme.colors.accent || theme.colors.primary) + 'CC',
  },
  chipText: {
    color: theme.colors.primaryContrast,
    fontSize: 13,
    fontWeight: '600',
    marginRight: 4,
    flexShrink: 1,
  },
  chipRemove: {
    padding: 2,
  },
  addAudienceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.primary + '60',
    borderStyle: 'dashed',
    gap: 4,
  },
  addAudienceText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  audienceWarning: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    marginTop: 8,
  },
}));

export default CreatePostScreen;
