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
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMemberCircles } from 'hooks/useCircle';
import ShaderBackground from 'components/ShaderBackground';
import { CreatePostDto } from 'services/generated/generatedClient';
import { useFocusEffect } from '@react-navigation/native';


const CreatePostScreen = ({ navigation, route }) => {
  const [postContent, setPostContent] = useState('');
  const [selectedCircleIds, setSelectedCircleIds] = useState([]);
  const { circles, isLoading, error, loadCircles } = useMemberCircles();

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

  // Render loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size={36} color="#0000ff" />
      </SafeAreaView>
    );
  }
  // Render error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
      <ShaderBackground />
      <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

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

  const handleSubmit = async () => {
    if (!isPostValid()) return;
    
    try {
      const response = await ApiClient.call(c => 
        c.postPOST(new CreatePostDto({
          text: postContent,
          circleIds: selectedCircleIds
        }))
      );
      setPostContent('');
      setSelectedCircleIds([]);
      console.log('Response:', response);
      // TODO update nswag.json to expect 201 response
      //if (response) {
       navigation.goBack();
     // }
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
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color="#1DA1F2" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Post</Text>
          <TouchableOpacity
            style={[styles.postButton, !isPostValid() && styles.postButtonDisabled]}
            onPress={handleSubmit}
            disabled={!isPostValid()}
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