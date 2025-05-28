import React, { useEffect, useState, useRef } from 'react';
import { LinkingOptions, NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, View, StyleSheet, Animated } from 'react-native';
import * as Linking from 'expo-linking';

// Screens
import HomeScreen from './screens/HomeSreen';
import CommentSection from './components/CommentSection';
import GroupsScreen from './screens/GroupScreen';
import CalendarScreen from './screens/CalendarScreen';
import ProfileScreen from './screens/ProfileScreen';
import SignInScreen from './screens/SignInScreen';
import CreatePostScreen from './screens/CreatePostScreen';
import { ActivityIndicator, SafeAreaView } from 'react-native';
import { AuthProvider, useAuth } from 'contexts/AuthContext';
import CreateCircleScreen from 'screens/CreateCircleScreen';

type RootStackParamList = {
  SignIn: undefined | { returnTo?: string };
  Main: undefined // This is the key change
  // TODO change to "Post"
  Comments: { postId: string };
  CreatePost: undefined;
  CreateCircle: undefined;
  Profile: { userId: string };
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

// Configure linking using expo-linking
const prefix = Linking.createURL('/');
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/'), 'https://frens-app.com', 'frens://'],
  config: {
    screens: {
      Main: {
        screens: {
          Feed: '',
          Groups: 'groups',
          Calendar: 'calendar',
          Me: 'me',
        },
      },
      Profile: 'profile/:userId',
      Comments: 'post/:postId',
      CreatePost: 'create-post',
      CreateCircle: 'create-circle',
    },
  },
};

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
        component={HomeScreen}
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
  const [initialURL, setInitialURL] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const getInitialURL = async () => {
      try {
        const url = await Linking.getInitialURL();
        console.log('Initial URL:', url);
        setInitialURL(url);
      } finally {
        setIsReady(true);
      }
    };

    if (!isReady) {
      getInitialURL();
    }
  }, [isReady]);

    // Helper function to check if URL needs redirect after auth
    const shouldRedirectAfterAuth = (url: string | null): boolean => {
      if (!url) return false;
      
      try {
        const parsedUrl = new URL(url);
        const pathname = parsedUrl.pathname;
        
        // Don't redirect for root paths or main tab routes
        if (pathname === '/' || 
            pathname === '/feed' || 
            pathname === '/groups' || 
            pathname === '/calendar' || 
            pathname === '/me' || 
            pathname === '') {
          return false;
        }
        
        // Redirect for specific protected routes
        return pathname.startsWith('/profile/') || 
               pathname.startsWith('/post/') || 
               pathname.startsWith('/create-');
      } catch (error) {
        // If URL parsing fails, don't redirect
        return false;
      }
    };
  // Show loading screen while checking auth state
  if (isAuthLoading || !isReady) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size={36} color="#1DA1F2" />
      </SafeAreaView>
    );
  }

  const authParams = !isAuthenticated && shouldRedirectAfterAuth(initialURL) 
    ? { returnTo: initialURL } 
    : undefined;

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {isAuthenticated ? (
          // Authenticated stack - all protected routes
          <Stack.Group>
            <Stack.Screen name="Main" component={BottomTabs} />
            <Stack.Screen 
              name="Profile" 
              component={ProfileScreen} 
              options={{ 
                title: 'Profile',
                headerShown: true,
                headerBackTitleVisible: false,
              }}
            />
            <Stack.Screen 
              name="Comments" 
              component={CommentSection} 
              options={{ 
                title: 'Comments',
                headerShown: true,
                headerBackTitleVisible: false,
              }} 
            />
            <Stack.Screen 
              name="CreatePost" 
              component={CreatePostScreen} 
              options={{
                title: 'Create Post',
                presentation: 'modal',
                headerShown: true,
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
            <Stack.Screen 
              name="CreateCircle" 
              component={CreateCircleScreen} 
              options={{ 
                title: 'Create Circle',
                headerShown: true,
                headerBackTitleVisible: false,
              }}
            />
          </Stack.Group>
        ) : (
          // Auth stack - only auth screen available when not authenticated
          <Stack.Screen 
            name="SignIn" 
            component={SignInScreen}
            initialParams={authParams}
            options={{
              // Prevent going back
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