import React, { useMemo, useState } from 'react';
import { ApiClient } from 'services/apiClient';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  Switch,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useMemberCircles } from 'hooks/useCircle';
import ShaderBackground from 'components/ShaderBackground';
import { CreatePostDto, CreateEventDto } from 'services/generated/generatedClient';
import { useFocusEffect } from '@react-navigation/native';
import Header from 'components/Header';


const CreatePostScreen = ({ navigation, route }) => {
  const [postContent, setPostContent] = useState('');
  const [selectedCircleIds, setSelectedCircleIds] = useState([]);
  const [asEvent, setAsEvent] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [startDate, setStartDate] = useState(''); // YYYY-MM-DD
  const [startTime, setStartTime] = useState(''); // HH:mm (24h)
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const { circles, isLoading, error, loadCircles } = useMemberCircles();
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // For refreshing data when this screen is navigated to
  useFocusEffect(
    React.useCallback(() => {
      // Check if we should refresh data when screen is focused
      if (route.params?.refresh) {
        loadCircles(); // Your function to fetch fresh data
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

  const isPostValid = () => {
    return postContent.trim() && selectedCircleIds.length > 0;
  };

  const isEventValid = useMemo(() => {
    if (!asEvent) return false;
    if (!eventTitle.trim()) return false;
    if (!startDate.match(/^\d{4}-\d{2}-\d{2}$/)) return false;
    if (!startTime.match(/^\d{2}:\d{2}$/)) return false;
    // End fields optional, but if one provided, require both
    const anyEnd = endDate.trim().length > 0 || endTime.trim().length > 0;
    if (anyEnd && (!endDate.match(/^\d{4}-\d{2}-\d{2}$/) || !endTime.match(/^\d{2}:\d{2}$/))) return false;
    if (selectedCircleIds.length === 0) return false;
    return true;
  }, [asEvent, eventTitle, startDate, startTime, endDate, endTime, selectedCircleIds]);

  // Render loading state (after hooks)
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size={36} color="#0000ff" />
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
    setFormError(null);
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

      try {
        const response = await ApiClient.call(c =>
          c.event_CreateEvent(new CreateEventDto({
            title: eventTitle.trim(),
            text: postContent.trim(),
            startDateTime: start,
            endDateTime: end,
            circleIds: selectedCircleIds,
          }))
        );
        // reset
        setPostContent('');
        setSelectedCircleIds([]);
        setEventTitle('');
        setStartDate('');
        setStartTime('');
        setEndDate('');
        setEndTime('');
        setAsEvent(false);
        console.log('Event created:', response);
        navigation.goBack();
      } catch (error) {
        console.error('Error creating event:', error);
        setFormError('Failed to create event.');
      }
      return;
    }

    // Normal post
    if (!isPostValid()) return;
    try {
      const response = await ApiClient.call(c =>
        c.post_CreatePost(new CreatePostDto({
          text: postContent.trim(),
          circleIds: selectedCircleIds,
        }))
      );
      setPostContent('');
      setSelectedCircleIds([]);
      console.log('Response:', response);
      navigation.goBack();
    } catch (error) {
      console.error('Error submitting post:', error);
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
            disabled: asEvent ? !isEventValid : !isPostValid()
          }}
        />

        <TextInput
          style={styles.input}
          placeholder={asEvent ? "What's this event about? (optional details)" : "What's happening?"}
          multiline
          value={postContent}
          onChangeText={setPostContent}
          autoFocus
          maxLength={280}
        />

        {/* Event toggle */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Create as Event</Text>
          <Switch value={asEvent} onValueChange={setAsEvent} />
        </View>

        {asEvent && (
          <View style={styles.eventForm}>
            <Text style={styles.formLabel}>Title</Text>
            <TextInput
              style={styles.inputField}
              placeholder="Event title"
              value={eventTitle}
              onChangeText={setEventTitle}
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
                      color: '#111',
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
                      color: '#111',
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
                      color: '#111',
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
                      color: '#111',
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
          {selectedCircleIds.length === 0 && (
            <Text style={styles.circleWarning}>Select at least one circle</Text>
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
                    color={selectedCircleIds.includes(item.id) ? "#fff" : "#1DA1F2"} 
                  />
                )}
                {!item.isShared && item.isOwner && (
                  <Ionicons 
                    name="person" 
                    size={20} 
                    color={selectedCircleIds.includes(item.id) ? "#fff" : "#1DA1F2"} 
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
                <Ionicons name="checkmark-circle" size={22} color="#fff" style={styles.checkIcon} />
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
                <Ionicons 
                  name="add" 
                  size={20} 
                  color="#1DA1F2" 
                />
              </View>
              <Text style={styles.createCircleText}>
                Create New Circle
              </Text>
            </TouchableOpacity>
          }
        /> 
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
  },
  keyboardAvoid: {
    flex: 1,
  },
  circleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  circleHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  circleWarning: {
    fontSize: 12,
    color: '#f5f8fa',
    fontStyle: 'italic',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
  },
  toggleLabel: { fontSize: 16, fontWeight: '500' },
  eventForm: {
    paddingHorizontal: 15,
    paddingTop: 8,
  },
  formLabel: {
    fontSize: 14,
    color: '#444',
    marginBottom: 6,
  },
  inputField: {
    backgroundColor: '#f5f8fa',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  inputButton: {
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', gap: 10 },
  rowItem: { flex: 1 },
  formError: { color: 'red', marginTop: 8 },
  circleList: {
    paddingHorizontal: 15,
    paddingBottom: 20,
  },
  circleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 12,
    marginVertical: 4,
    backgroundColor: '#f5f8fa',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  selectedCircleItem: {
    backgroundColor: '#1DA1F2',
  },
  circleIconContainer: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleName: {
    fontSize: 16,
    marginLeft: 8,
    flex: 1,
  },
  selectedCircleText: {
    color: '#fff',
    fontWeight: '500',
  },
  checkIcon: {
    marginLeft: 5,
  },
  input: {
    padding: 20,
    fontSize: 18,
    textAlignVertical: 'top',
    minHeight: 120,
    borderColor: "white"
  },
  createCircleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 12,
    marginVertical: 4,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#1DA1F2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  createCircleText: {
    fontSize: 16,
    marginLeft: 8,
    flex: 1,
    color: '#1DA1F2',
    fontWeight: '500',
  },
});

export default CreatePostScreen;