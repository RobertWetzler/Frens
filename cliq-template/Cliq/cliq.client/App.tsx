import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '@supabase/supabase-js';

// Screens
import HomeScreen from './screens/HomeSreen';
import CommentSection from './components/CommentSection';
import GroupsScreen from './screens/GroupScreen';
import CalendarScreen from './screens/CalendarScreen';
import ProfileScreen from './screens/CalendarScreen';
import SignInScreen from './screens/SignInScreen';
import { ActivityIndicator, SafeAreaView } from 'react-native';
import AnimatedBackground from './components/AnimatedBackground';
import { AuthProvider, useAuth } from 'contexts/AuthContext';

type RootStackParamList = {
    Auth: undefined;
    Main: undefined;
    Comments: undefined;
};

type TabParamList = {
    Feed: undefined;
    Groups: undefined;
    Calendar: undefined;
    Me: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const BottomTabs = () => {
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
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Feed" component={HomeScreen} />
      <Tab.Screen name="Groups" component={GroupsScreen} />
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

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}