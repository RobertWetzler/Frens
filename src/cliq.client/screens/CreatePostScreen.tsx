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
  Switch,
  Image,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useCreatePostData } from 'hooks/useCircle';
import ShaderBackground from 'components/ShaderBackground';
import { CreateEventDto } from 'services/generated/generatedClient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system'; // added for size lookup
import { useFocusEffect } from '@react-navigation/native';
import Header from 'components/Header';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';
import { feedEvents, FEED_POST_CREATED, FEED_POST_STATUS_UPDATED, OptimisticPost } from 'hooks/feedEvents';


const CreatePostScreen = ({ navigation, route }) => {
  const { theme } = useTheme();
  const styles = useStyles();
  const [postContent, setPostContent] = useState('');
  const [selectedCircleIds, setSelectedCircleIds] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [asEvent, setAsEvent] = useState(false);
  const [images, setImages] = useState<Array<{ uri: string; fileName: string; type: string; size?: number; webFile?: File }>>([]); // added size
  const [eventTitle, setEventTitle] = useState('');
  const [startDate, setStartDate] = useState(''); // YYYY-MM-DD
  const [startTime, setStartTime] = useState(''); // HH:mm (24h)
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { circles, friends, isLoading, error, loadData } = useCreatePostData();
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // For refreshing data when this screen is navigated to
  useFocusEffect(
    React.useCallback(() => {
      // Check if we should refresh data when screen is focused
      if (route.params?.refresh) {
        loadData(); // Your function to fetch fresh data
        // Clear the parameter after refresh
        navigation.setParams({ refresh: undefined });
      }
    }, [route.params?.refresh])
  );

  // NOTE: Defer loading/error early returns until after all hooks to preserve hook order

  const toggleCircleSelection = (circleId) => {
    setSelectedCircleIds(prevSelected =>
      prevSelected.includes(circleId)
        ? prevSelected.filter(id => id !== circleId)
        : [...prevSelected, circleId]
    );
  };

  const toggleUserSelection = (userId) => {
    setSelectedUserIds(prevSelected =>
      prevSelected.includes(userId)
        ? prevSelected.filter(id => id !== userId)
        : [...prevSelected, userId]
    );
  };

  const isPostValid = () => {
    return (postContent.trim() || images.length > 0) && (selectedCircleIds.length > 0 || selectedUserIds.length > 0);
  };

  const isEventValid = useMemo(() => {
    if (!asEvent) return false;
    if (!eventTitle.trim()) return false;
    if (!startDate.match(/^\d{4}-\d{2}-\d{2}$/)) return false;
    if (!startTime.match(/^\d{2}:\d{2}$/)) return false;
    // End fields optional, but if one provided, require both
    const anyEnd = endDate.trim().length > 0 || endTime.trim().length > 0;
    if (anyEnd && (!endDate.match(/^\d{4}-\d{2}-\d{2}$/) || !endTime.match(/^\d{2}:\d{2}$/))) return false;
    if (selectedCircleIds.length === 0 && selectedUserIds.length === 0) return false;
    return true;
  }, [asEvent, eventTitle, startDate, startTime, endDate, endTime, selectedCircleIds, selectedUserIds]);

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
    // Construct ISO-like string to avoid locale parsing issues
    const iso = `${dateStr}T${timeStr}:00`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  };

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const toTimeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const handleSubmit = async () => {
    // Prevent double-submission
    if (isSubmitting) return;

    setFormError(null);
    const MAX_TOTAL_IMAGES_BYTES = 50 * 1024 * 1024; // 50 MB
    if (!asEvent && images.length > 0) { // validate total image size for posts
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

      // Create optimistic event
      const optimisticId = `optimistic-${Date.now()}-${Math.random()}`;
      const optimisticEvent: OptimisticPost = {
        id: optimisticId,
        text: postContent.trim(),
        date: new Date(),
        user: { id: '', name: 'You', email: '' }, // Will be filled from context
        sharedWithCircles: circles.filter(c => selectedCircleIds.includes(c.id)),
        commentCount: 0,
        hasImage: false,
        _optimisticId: optimisticId,
        _status: 'pending',
        // Event-specific fields
        _discriminator: 'Event',
        title: eventTitle.trim(),
        startDateTime: start,
        endDateTime: end,
        isEvent: true,
      } as any;

      // Emit optimistic event immediately
      feedEvents.emit(FEED_POST_CREATED, optimisticEvent);

      // Reset form and navigate back immediately
      const capturedContent = postContent.trim();
      const capturedTitle = eventTitle.trim();
      const capturedCircleIds = [...selectedCircleIds];
      const capturedUserIds = [...selectedUserIds];
      setPostContent('');
      setSelectedCircleIds([]);
      setSelectedUserIds([]);
      setEventTitle('');
      setStartDate('');
      setStartTime('');
      setEndDate('');
      setEndTime('');
      setAsEvent(false);
      setIsSubmitting(false);
      navigation.goBack();

      // Make API call in background
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
        console.log('Event created:', response);
        // Update optimistic event with actual response
        feedEvents.emit(FEED_POST_STATUS_UPDATED, {
          optimisticId,
          status: 'posted',
          actualPost: response,
        });
      } catch (error) {
        console.error('Error creating event:', error);
        // Update status to failed
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

    // Create optimistic post
    const optimisticId = `optimistic-${Date.now()}-${Math.random()}`;
    const optimisticPost: OptimisticPost = {
      id: optimisticId,
      text: postContent.trim() || '',
      date: new Date(),
      user: { id: '', name: 'You', email: '' }, // Will be filled from context
      sharedWithCircles: circles.filter(c => selectedCircleIds.includes(c.id)),
      commentCount: 0,
      hasImage: images.length > 0,
      _optimisticId: optimisticId,
      _status: 'pending',
      _localImages: images.map(img => ({ uri: img.uri, fileName: img.fileName, type: img.type, webFile: img.webFile })),
    } as OptimisticPost;

    // Emit optimistic post immediately
    feedEvents.emit(FEED_POST_CREATED, optimisticPost);

    // Reset form and navigate back immediately
    const capturedContent = postContent.trim() || null;
    const capturedCircleIds = [...selectedCircleIds];
    const capturedUserIds = [...selectedUserIds];
    const capturedImages = [...images];
    setPostContent('');
    setSelectedCircleIds([]);
    setSelectedUserIds([]);
    setImages([]);
    setIsSubmitting(false);
    navigation.goBack();

    // Make API call in background
    try {
      const fileParams = capturedImages.map(img => ({
        data: Platform.OS === 'web' ? (img.webFile as any) : { uri: img.uri, name: img.fileName, type: img.type },
        fileName: img.fileName,
      }));
      const response = await ApiClient.call(c =>
        c.post_CreatePost(capturedContent, capturedCircleIds, capturedUserIds, fileParams)
      );
      console.log('Post created:', response);
      // Update optimistic post with actual response
      feedEvents.emit(FEED_POST_STATUS_UPDATED, {
        optimisticId,
        status: 'posted',
        actualPost: response,
      });
    } catch (error) {
      console.error('Error submitting post:', error);
      // Update status to failed
      feedEvents.emit(FEED_POST_STATUS_UPDATED, {
        optimisticId,
        status: 'failed',
        error: 'Failed to create post',
      });
    }
  };

  const handleCreateNewCircle = () => {
    navigation.navigate('CreateCircle', {
      onReturn: () => navigation.setParams({ refresh: true })
    });  };

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

        <TextInput
          style={styles.input}
          placeholder={asEvent ? "What's this event about? (optional details)" : "What's boopping?"}
          multiline
          value={postContent}
          onChangeText={setPostContent}
          autoFocus
          maxLength={1000}
          placeholderTextColor={theme.colors.inputPlaceholder}
        />

        {/* Event toggle */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Create as Event</Text>
          <Switch
            value={asEvent}
            onValueChange={setAsEvent}
            trackColor={{ false: theme.colors.separator, true: theme.colors.primary }}
            thumbColor={Platform.OS === 'android' ? theme.colors.card : undefined}
          />
        </View>

        {/* Image attachments */}
        {!asEvent && (
          <View style={styles.imageBar}>
            {Platform.OS === 'web' ? (
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
                  style={styles.imageButton}
                  onPress={() => (document.getElementById('post-image-input') as HTMLInputElement)?.click()}
                  activeOpacity={0.7}
                >
                  <Ionicons name="image-outline" size={22} color={theme.colors.primary} />
                  <Text style={styles.imageButtonText}>{images.length > 0 ? `${images.length} photo${images.length > 1 ? 's' : ''} attached` : 'Add Photos'}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.imageButton}
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
                <Ionicons name="image-outline" size={22} color={theme.colors.primary} />
                <Text style={styles.imageButtonText}>{images.length > 0 ? `${images.length} photo${images.length > 1 ? 's' : ''} attached` : 'Add Photos'}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {images.length > 0 && !asEvent && (
          <View style={styles.thumbRow}>
            <FlatList
              horizontal
              data={images}
              keyExtractor={(item) => item.uri}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item, index }) => (
                <View style={styles.thumbWrapper}>
                  {/* @ts-ignore: React Native web + native image */}
                  <Image source={{ uri: item.uri }} style={styles.thumbImage} />
                  {/* X remove button on top */}
                  <TouchableOpacity
                    onPress={() => setImages(prev => prev.filter((_, i) => i !== index))}
                    style={styles.removeThumb}
                    accessibilityRole="button"
                    accessibilityLabel="Remove image"
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close" size={16} color={theme.colors.primaryContrast} />
                  </TouchableOpacity>
                </View>
              )}
              contentContainerStyle={styles.thumbList}
            />
          </View>
        )}

        {formError ? <Text style={styles.formError}>{formError}</Text> : null}

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
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontSize: 16,
                      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
                      color: theme.colors.textPrimary,
                      padding: 0,
                      margin: 0,
                      lineHeight: 'normal',
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
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontSize: 16,
                      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
                      color: theme.colors.textPrimary,
                      padding: 0,
                      margin: 0,
                      lineHeight: 'normal',
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
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontSize: 16,
                      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
                      color: theme.colors.textPrimary,
                      padding: 0,
                      margin: 0,
                      lineHeight: 'normal',
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
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontSize: 16,
                      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
                      color: theme.colors.textPrimary,
                      padding: 0,
                      margin: 0,
                      lineHeight: 'normal',
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

            {formError ? <Text style={styles.formError}>{formError}</Text> : null}
          </View>
        )}

        <View style={styles.circleSection}>
          <Text style={styles.circleHeaderTitle}>Share with Circles</Text>
          {selectedCircleIds.length === 0 && selectedUserIds.length === 0 && (
            <Text style={styles.circleWarning}>Select at least one circle or friend</Text>
          )}
        </View>

        <FlatList
          data={circles}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({item}) => (
            <TouchableOpacity
              style={[
                styles.circleItem,
                selectedCircleIds.includes(item.id) && styles.selectedCircleItem
              ]}
              onPress={() => toggleCircleSelection(item.id)}
              activeOpacity={0.7}
            >
              <View style={styles.circleIconContainer}>
                {item.isShared && (
                  <Ionicons
                    name="people"
                    size={20}
                    color={selectedCircleIds.includes(item.id) ? theme.colors.primaryContrast : theme.colors.primary}
                  />
                )}
                {!item.isShared && item.isOwner && (
                  <Ionicons
                    name="person"
                    size={20}
                    color={selectedCircleIds.includes(item.id) ? theme.colors.primaryContrast : theme.colors.primary}
                  />
                )}
              </View>
              <Text style={[
                styles.circleName,
                selectedCircleIds.includes(item.id) && styles.selectedCircleText
              ]}>
                {item.name}
              </Text>
              {selectedCircleIds.includes(item.id) && (
                <Ionicons name="checkmark-circle" size={22} color={theme.colors.primaryContrast} style={styles.checkIcon} />
              )}
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.circleList}
          ListFooterComponent={
            <TouchableOpacity
              style={styles.createCircleButton}
              onPress={handleCreateNewCircle}
              activeOpacity={0.7}
            >
              <View style={styles.circleIconContainer}>
                <Ionicons name="add" size={20} color={theme.colors.primary} />
              </View>
              <Text style={styles.createCircleText}>
                Create New Circle
              </Text>
            </TouchableOpacity>
          }
        />

        <View style={styles.circleSection}>
          <Text style={styles.circleHeaderTitle}>Share with Friends</Text>
        </View>

        <FlatList
          data={friends}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({item}) => (
            <TouchableOpacity
              style={[
                styles.circleItem,
                selectedUserIds.includes(item.id) && styles.selectedCircleItem
              ]}
              onPress={() => toggleUserSelection(item.id)}
              activeOpacity={0.7}
            >
              <View style={styles.circleIconContainer}>
                <Ionicons
                  name="person"
                  size={20}
                  color={selectedUserIds.includes(item.id) ? theme.colors.primaryContrast : theme.colors.primary}
                />
              </View>
              <Text style={[
                styles.circleName,
                selectedUserIds.includes(item.id) && styles.selectedCircleText
              ]}>
                {item.name}
              </Text>
              {selectedUserIds.includes(item.id) && (
                <Ionicons name="checkmark-circle" size={22} color={theme.colors.primaryContrast} style={styles.checkIcon} />
              )}
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.circleList}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
// makeStyles at bottom
const useStyles = makeStyles((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.backgroundAlt },
  errorText: { color: theme.colors.danger, textAlign: 'center', marginTop: 20 },
  keyboardAvoid: { flex: 1 },
  imageBar: { flexDirection: 'row', paddingHorizontal: 15, paddingTop: 10 },
  imageButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.card, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.inputBorder },
  imageButtonText: { marginLeft: 8, color: theme.colors.primary, fontWeight: '500' },
  thumbRow: { paddingTop: 8, paddingHorizontal: 15 },
  thumbList: { gap: 8 },
  thumbWrapper: { width: 70, height: 70, borderRadius: 10, overflow: 'hidden', marginRight: 8, backgroundColor: theme.colors.card, position: 'relative' },
  thumbImage: { width: '100%', height: '100%' },
  removeThumb: { position: 'absolute', top: 4, right: 4, backgroundColor: theme.colors.primary, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  circleSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10 },
  circleHeaderTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary },
  circleWarning: { fontSize: 12, color: theme.colors.textMuted, fontStyle: 'italic' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15 },
  toggleLabel: { fontSize: 16, fontWeight: '500', color: theme.colors.textPrimary },
  eventForm: { paddingHorizontal: 15, paddingTop: 8 },
  formLabel: { fontSize: 14, color: theme.colors.textSecondary, marginBottom: 6 },
  inputField: {
    backgroundColor: theme.colors.card, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16,
    borderWidth: 1, borderColor: theme.colors.inputBorder, color: theme.colors.textPrimary,
  },
  inputButton: { justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 10 },
  rowItem: { flex: 1 },
  formError: { color: theme.colors.danger, marginTop: 8 },
  circleList: { paddingHorizontal: 15, paddingBottom: 20 },
  circleItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 12, marginVertical: 4,
    backgroundColor: theme.colors.card, shadowColor: theme.colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1, elevation: 1,
  },
  selectedCircleItem: { backgroundColor: theme.colors.primary },
  circleIconContainer: { width: 30, alignItems: 'center', justifyContent: 'center' },
  circleName: { fontSize: 16, marginLeft: 8, flex: 1, color: theme.colors.textPrimary },
  selectedCircleText: { color: theme.colors.primaryContrast, fontWeight: '500' },
  checkIcon: { marginLeft: 5 },
  input: {
    padding: 20, fontSize: 18, textAlignVertical: 'top', minHeight: 120, backgroundColor: theme.colors.card, color: theme.colors.textPrimary,
    borderWidth: 1, borderColor: theme.colors.inputBorder, borderRadius: 12,
  },
  createCircleButton: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 12, marginVertical: 4,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.primary,
    shadowColor: theme.colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1, elevation: 1,
  },
  createCircleText: { fontSize: 16, marginLeft: 8, flex: 1, color: theme.colors.primary, fontWeight: '500' },
}));

export default CreatePostScreen;