import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '@supabase/supabase-js';
import { TouchableOpacity, View, StyleSheet, Animated } from 'react-native';

// Screens
import HomeScreen from './screens/HomeSreen';
import CommentSection from './components/CommentSection';
import GroupsScreen from './screens/GroupScreen';
import CalendarScreen from './screens/CalendarScreen';
import ProfileScreen from './screens/ProfileScreen';
import SignInScreen from './screens/SignInScreen';
import CreatePostScreen from './screens/CreatePostScreen'; // You'll need to create this
import { ActivityIndicator, SafeAreaView } from 'react-native';
import AnimatedBackground from './components/AnimatedBackground';
import { AuthProvider, useAuth } from 'contexts/AuthContext';

type RootStackParamList = {
    Auth: undefined;
    Main: undefined;
    Comments: undefined;
    CreatePost: undefined;
};

type TabParamList = {
    Feed: undefined;
    Groups: undefined;
    Create: undefined;
    Calendar: undefined;
    Me: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const CreateButton = ({ onPress }) => {
  return (
    <TouchableOpacity
      style={styles.createButtonContainer}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.createButton}>
        <Ionicons name="add" size={30} color="#FFF" />
      </View>
    </TouchableOpacity>
  );
};

const BottomTabs = ({ navigation }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  
  const openCreatePost = () => {
    // First start the animation
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    // Navigate to the create post screen
    navigation.navigate('CreatePost');
  };
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Feed') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Groups') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Calendar') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Me') {
            iconName = focused ? 'person' : 'person-outline';
          }

          // Return null for the Create tab as we'll render a custom button
          if (route.name === 'Create') return null;

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#1DA1F2',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          borderTopWidth: 0,
          elevation: 0,
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 60,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Feed" component={HomeScreen} />
      <Tab.Screen name="Groups" component={GroupsScreen} />
      <Tab.Screen 
        name="Create" 
        component={HomeScreen} // This is a dummy component, we'll never navigate here directly
        options={{
          tabBarButton: () => (
            <CreateButton onPress={openCreatePost} />
          ),
        }}
      />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Me" component={ProfileScreen} />
    </Tab.Navigator>
  );
};


const MainApp = () => {
  const { isAuthenticated, isAuthLoading } = useAuth();

  // Show a loading screen while checking auth state
  if (isAuthLoading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size={36} color="#0000ff" />
      </SafeAreaView>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {isAuthenticated ? (
          // Authenticated stack
          <>
            <Stack.Screen name="Main" component={BottomTabs} />
            <Stack.Screen 
              name="Comments" 
              component={CommentSection} 
              options={{ title: 'Comments' }} 
            />
            <Stack.Screen 
              name="CreatePost" 
              component={CreatePostScreen} 
              options={{
                presentation: 'modal',
                cardStyleInterpolator: ({ current }) => ({
                  cardStyle: {
                    transform: [
                      {
                        translateY: current.progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [600, 0],
                        }),
                      },
                    ],
                  },
                }),
              }} 
            />
          </>
        ) : (
          // Auth stack
          <Stack.Screen 
            name="Auth" 
            component={SignInScreen}
            options={{
              // Prevent going back to auth screen once logged in
              headerLeft: () => null,
              gestureEnabled: false,
            }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  createButtonContainer: {
    bottom: 15,
  },
  createButton: {
    backgroundColor: '#1DA1F2',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}