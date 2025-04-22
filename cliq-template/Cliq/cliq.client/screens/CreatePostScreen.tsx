import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CreatePostScreen = ({ navigation }) => {
  const [postContent, setPostContent] = useState('');

  const handleSubmit = async () => {
    // Add logic to submit the post
    console.log('Submitting post:', postContent);
    try {
      const response = await ApiClient.call(c => c.postPOST(postContent));
      console.log('Response:', response);
      if (response) {
        // Close the modal and return to the previous screen
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error submitting post:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color="#1DA1F2" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Post</Text>
          <TouchableOpacity 
            style={[styles.postButton, !postContent.trim() && styles.postButtonDisabled]} 
            onPress={handleSubmit}
            disabled={!postContent.trim()}
          >
            <Text style={styles.postButtonText}>Post</Text>
          </TouchableOpacity>
        </View>
        
        <TextInput
          style={styles.input}
          placeholder="What's happening?"
          multiline
          value={postContent}
          onChangeText={setPostContent}
          autoFocus
          maxLength={280}
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
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    padding: 20,
    fontSize: 18,
    textAlignVertical: 'top',
  },
  postButton: {
    backgroundColor: '#1DA1F2',
    paddingVertical: 6,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  postButtonDisabled: {
    backgroundColor: '#8EC5F4',
  },
  postButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default CreatePostScreen;