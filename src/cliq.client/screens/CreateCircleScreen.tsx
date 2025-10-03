import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Switch,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiClient } from 'services/apiClient';
import ShaderBackground from 'components/ShaderBackground';
import { CircleCreationDto } from 'services/generated/generatedClient';
import { useTheme } from '../theme/ThemeContext';
import { makeStyles } from '../theme/makeStyles';

const CreateCircleScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = useStyles();
  const [circleName, setCircleName] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState([]);
  const [friends, setFriends] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      setIsLoading(true);
      const response = await ApiClient.call(c => c.frenship_GetFriends());
      // TODO: Use this to verify scrollability on mobile
      response.sort((u1, u2) => u1.name.localeCompare(u2.name));
      setFriends(response);
      setError(null);
    } catch (err) {
      setError('Failed to load friends. Please try again.');
      console.error('Error loading friends:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFriendSelection = (friendId) => {
    setSelectedFriendIds(prevSelected => 
      prevSelected.includes(friendId)
        ? prevSelected.filter(id => id !== friendId)
        : [...prevSelected, friendId]
    );
  };

  const isFormValid = () => {
    return circleName.trim();
  };

  const handleSubmit = async () => {
    if (!isFormValid()) return;
    
    try {
      setIsSubmitting(true);
      await ApiClient.call(c => 
        c.circle_CreateCircle(new CircleCreationDto({
          name: circleName,
          isShared: isShared,
          userIdsToAdd: selectedFriendIds
        }))
      );
      
      // Return to previous screen
      navigation.navigate('CreatePost', { refresh: true });
    } catch (error) {
      console.error('Error creating circle:', error);
      Alert.alert(
        'Error',
        'Failed to create circle. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };
 
  // Render loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size={36} color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  // Render error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <ShaderBackground />
  <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadFriends}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack({refresh: true})}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create New Circle</Text>
          <TouchableOpacity
            style={[styles.createButton, !isFormValid() && styles.createButtonDisabled]}
            onPress={handleSubmit}
            disabled={!isFormValid() || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={theme.colors.primaryContrast} />
            ) : (
              <Text style={styles.createButtonText}>Create</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.inputLabel}>Circle Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter circle name"
            value={circleName}
            onChangeText={setCircleName}
            autoFocus
            maxLength={50}
          />

          <View style={styles.switchContainer}>
            <Text style={styles.switchLabel}>Shared Circle</Text>
            <Switch
              value={isShared}
              onValueChange={setIsShared}
              trackColor={{ false: theme.colors.separator, true: theme.colors.primary }}
              thumbColor={isShared ? theme.colors.primary : theme.colors.card }
              ios_backgroundColor={theme.colors.separator}
            />
          </View>

          <View style={styles.friendsSection}>
            <Text style={styles.friendsSectionTitle}>Add Friends to Circle</Text>
            
            <FlatList
              data={friends}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({item}) => (
                <TouchableOpacity 
                  style={[
                    styles.friendItem, 
                    selectedFriendIds.includes(item.id) && styles.selectedFriendItem
                  ]}
                  onPress={() => toggleFriendSelection(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.friendIconContainer}>
                    <Ionicons
                      name="person"
                      size={20}
                      color={selectedFriendIds.includes(item.id) ? theme.colors.primaryContrast : theme.colors.primary}
                    />
                  </View>
                  <Text style={[
                    styles.friendName, 
                    selectedFriendIds.includes(item.id) && styles.selectedFriendText
                  ]}>
                    {item.name || item.username}
                  </Text>
                  {selectedFriendIds.includes(item.id) && (
                    <Ionicons name="checkmark-circle" size={22} color={theme.colors.primaryContrast} style={styles.checkIcon} />
                  )}
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.friendsList}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// makeStyles at bottom
const useStyles = makeStyles((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.card },
  keyboardAvoid: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.separator, backgroundColor: theme.colors.card,
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: theme.colors.textPrimary },
  formContainer: { padding: 20 },
  inputLabel: { fontSize: 16, fontWeight: '500', marginBottom: 8, color: theme.colors.textPrimary },
  input: {
    borderWidth: 1, borderColor: theme.colors.inputBorder, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 20,
    color: theme.colors.textPrimary, backgroundColor: theme.colors.card,
  },
  switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  switchLabel: { fontSize: 16, fontWeight: '500', color: theme.colors.textPrimary },
  friendsSection: { marginTop: 10 },
  friendsSectionTitle: { fontSize: 16, fontWeight: '500', marginBottom: 8, color: theme.colors.textPrimary },
  friendsList: { paddingBottom: 20 },
  friendItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 12,
    marginVertical: 4, backgroundColor: theme.colors.backgroundAlt, shadowColor: theme.colors.shadow, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 1, elevation: 1,
  },
  selectedFriendItem: { backgroundColor: theme.colors.primary },
  friendIconContainer: { width: 30, alignItems: 'center', justifyContent: 'center' },
  friendName: { fontSize: 16, marginLeft: 8, flex: 1, color: theme.colors.textPrimary },
  selectedFriendText: { color: theme.colors.primaryContrast, fontWeight: '500' },
  checkIcon: { marginLeft: 5 },
  createButton: { backgroundColor: theme.colors.primary, paddingVertical: 6, paddingHorizontal: 15, borderRadius: 20, minWidth: 70, alignItems: 'center' },
  createButtonDisabled: { backgroundColor: theme.colors.textMuted },
  createButtonText: { color: theme.colors.primaryContrast, fontWeight: '600' },
  errorText: { color: theme.colors.danger, textAlign: 'center', marginTop: 20, marginBottom: 10 },
  retryButton: { backgroundColor: theme.colors.primary, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, alignSelf: 'center' },
  retryButtonText: { color: theme.colors.primaryContrast, fontWeight: '600' },
}));

export default CreateCircleScreen;
