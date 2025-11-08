import 'react-native-gesture-handler';
import React, { useEffect, useState, useRef } from 'react';
import * as Font from 'expo-font';
import { LinkingOptions, NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, View, StyleSheet, Animated, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Linking from 'expo-linking';

// Screens
import HomeScreen from './screens/HomeSreen';
import CommentSection from './components/CommentSection';
import GroupsScreen from './screens/GroupScreen';
import CirclesScreen from './screens/CirclesScreen';
import CalendarScreen from './screens/CalendarScreen';
import ProfileScreen from './screens/ProfileScreen';
import SignInScreen from './screens/SignInScreen';
import CreatePostScreen from './screens/CreatePostScreen';
import { ActivityIndicator, SafeAreaView } from 'react-native';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import { AuthProvider, useAuth } from 'contexts/AuthContext';
import CreateCircleScreen from 'screens/CreateCircleScreen';
import AddUsersToCircleScreen from 'screens/AddUsersToCircleScreen';
import NotificationsScreen from 'screens/NotificationScreen';
import { useServiceWorker } from './hooks/useServiceWorker';
import { ShaderBackgroundProvider } from 'contexts/ShaderBackgroundContext';
import GlobalShaderBackground from 'components/GlobalShaderBackground';
import { enableImageBinaryCacheDebug, getImageBinaryCacheStats } from 'services/imageBinaryCache';

type RootStackParamList = {
  SignIn: undefined | { returnTo?: string };
  Main: undefined
  Comments: { postId: string };
  CreatePost: undefined;
  CreateCircle: undefined;
  AddUsersToCircle: { circleId: string; circleName: string; existingUserIds: string[] };
  Profile: { userId: string };
  Notifications: undefined;
};

type TabParamList = {
    Feed: undefined;
    Circles: undefined;
    Groups: undefined;
    Post: undefined;
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
    initialRouteName: "Main",
    screens: {
      Main: {
        screens: {
          Feed: '',
          Circles: 'circles',
          Groups: 'groups',
          Calendar: 'calendar',
          Me: 'me',
        },
      },
      Profile: 'profile/:userId',
      Comments: 'post/:postId',
      CreatePost: 'create-post',
      CreateCircle: 'create-circle',
      Notifications: 'notifications',
    },
  },
};

const CreateButton = ({ onPress }) => {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      style={styles.createButtonContainer}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[
        styles.createButton,
        { backgroundColor: theme.colors.primary, shadowColor: theme.colors.shadow }
      ]}>
        <Ionicons name="add" size={30} color={theme.colors.primaryContrast} />
      </View>
    </TouchableOpacity>
  );
};

const BottomTabs = ({ navigation }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const { theme } = useTheme();
  
  const openCreatePost = () => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    navigation.navigate('CreatePost');
  };
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Feed') {
            iconName = focused ? 'home' : 'home-outline';
          }
          else if (route.name === 'Circles') {
            iconName = focused ? 'people' : 'people-outline';
          }
          else if (route.name === 'Post') {
            iconName = focused ? 'add' : 'add-outline';
          }
          else if (route.name === 'Groups') {
            iconName = focused ? 'albums' : 'albums-outline';
          } else if (route.name === 'Calendar') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Me') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.isDark ? 'rgba(30,30,30,0.85)' : 'rgba(255,255,255,0.8)',
          borderTopWidth: 0,
          elevation: 0,
          position: 'absolute',
          left: 0,
            right: 0,
          bottom: 0,
          height: 60,
          // Add safe area for iOS PWA
          paddingBottom: Platform.OS === 'web' && Platform.select({
            web: typeof window !== 'undefined' && (window.navigator as any).standalone ? 20 : 0,
            default: 0
          }),
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Feed" component={HomeScreen} />
      <Tab.Screen name="Circles" component={CirclesScreen} />
      <Tab.Screen 
        name="Post"
        component={CreatePostScreen}
      />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Me" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const MainApp = () => {
  // Access theme
  const { theme } = useTheme();
  const { isAuthenticated, isAuthLoading } = useAuth();
  const [initialURL, setInitialURL] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // Register service worker
  useServiceWorker();

  useEffect(() => {
    enableImageBinaryCacheDebug(true);
    const interval = setInterval(() => {
      const stats = getImageBinaryCacheStats();
      // eslint-disable-next-line no-console
      console.log('[ImageBinCache][stats]', stats);
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const url = await Linking.getInitialURL();
        setInitialURL(url);
        // Attempt to load spooky font; if missing, ignore error.
        try {
          // await Font.loadAsync({
          //   SpookyHalloween: require('./assets/fonts/spooky-font.ttf'),
          // });
          setFontsLoaded(true);
        } catch (err) {
          console.warn('Spooky font not loaded (expected if file missing):', err?.message || err);
        }
      } finally {
        setIsReady(true);
      }
    };
    if (!isReady) bootstrap();
  }, [isReady]);

  // PWA Install prompt handler
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Hide address bar on mobile browsers
      const hideAddressBar = () => {
        window.scrollTo(0, 1);
      };
      
      // Prevent zoom on double tap
      let lastTouchEnd = 0;
      const preventZoom = (e) => {
        const now = new Date().getTime();
        if (now - lastTouchEnd <= 300) {
          e.preventDefault();
        }
        lastTouchEnd = now;
      };
      
      document.addEventListener('touchend', preventZoom, false);
      window.addEventListener('load', hideAddressBar);
      
      return () => {
        document.removeEventListener('touchend', preventZoom, false);
        window.removeEventListener('load', hideAddressBar);
      };
    }
  }, []);

  const shouldRedirectAfterAuth = (url: string | null): boolean => {
    if (!url) return false;
    
    try {
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname;
      
      if (pathname === '/' || 
          pathname === '/feed' || 
          pathname === '/groups' || 
          pathname === '/calendar' || 
          pathname === '/me' || 
          pathname === '') {
        return false;
      }
      
      return pathname.startsWith('/profile/') || 
             pathname.startsWith('/post/') || 
             pathname.startsWith('/create-');
    } catch (error) {
      return false;
    }
  };

  if (isAuthLoading || !isReady) {
    return (
      <SafeAreaView style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        // Ensure full screen on iOS PWA
        paddingTop: Platform.OS === 'web' && Platform.select({
          web: typeof window !== 'undefined' && (window.navigator as any).standalone ? 40 : 0,
          default: 0
        })
      }}>
  <ActivityIndicator size={36} color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const authParams = !isAuthenticated && shouldRedirectAfterAuth(initialURL) 
    ? { returnTo: initialURL } 
    : undefined;

  return (
    <View style={styles.mainAppContainer}>
      <NavigationContainer 
        linking={linking}
        theme={{
          dark: theme.isDark,
          colors: {
            primary: theme.colors.primary,
            background: theme.colors.background,
            card: theme.colors.background,
            text: theme.colors.textPrimary,
            border: theme.colors.separator,
            notification: theme.colors.notification,
          },
        }}
      >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: 'transparent', flex: 1 }, // Add flex: 1 for proper scrolling
          animationEnabled: true,
        }}
      >
        {isAuthenticated ? (
          <Stack.Group>
            <Stack.Screen name="Main" component={BottomTabs} />
            <Stack.Screen 
              name="Profile" 
              component={ProfileScreen} 
              options={{ 
                title: 'Profile',
                headerShown: false,
                headerBackTitleVisible: false,
              }}
            />
            <Stack.Screen 
              name="Comments" 
              component={CommentSection} 
              options={{ 
                title: 'Comments',
                headerShown: false,
                headerBackTitleVisible: false,
              }} 
            />
            <Stack.Screen 
              name="CreatePost" 
              component={CreatePostScreen} 
              options={{
                title: 'Create Post',
                presentation: 'modal',
                headerShown: false,
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
                headerShown: false,
                headerBackTitleVisible: false,
              }}
            />
            <Stack.Screen 
              name="AddUsersToCircle" 
              component={AddUsersToCircleScreen} 
              options={{ 
                title: 'Add Users',
                headerShown: false,
                headerBackTitleVisible: false,
              }}
            />
            <Stack.Screen 
              name="Notifications" 
              component={NotificationsScreen} 
              options={{ 
                title: 'Notifications',
                headerShown: false,
                headerBackTitleVisible: false,
              }}
            />
          </Stack.Group>
        ) : (
          <Stack.Screen 
            name="SignIn" 
            component={SignInScreen}
            initialParams={authParams}
            options={{
              headerLeft: () => null,
              gestureEnabled: false,
              cardStyle: { backgroundColor: 'transparent' }, // Ensure transparent background
            }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
    </View>
  );
};

const styles = StyleSheet.create({
  mainAppContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  createButtonContainer: {
    bottom: 15,
  },
  createButton: {
    // Dynamic styles will be composed inline when used to pull from theme
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <ShaderBackgroundProvider>
            {/* Wrapper View creates proper sibling relationship between shader background and MainApp,
                allowing z-index layering to work correctly with React Navigation's DOM structure.
                Needed for preventing MainApp UI from blocking background. */}
            <View style={{ flex: 1 }}>
              <GlobalShaderBackground />
              <ThemedMainAppWrapper />
            </View>
          </ShaderBackgroundProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

// Wrapper to inject dynamic themed FAB (floating action button) style example if needed later
const ThemedMainAppWrapper: React.FC = () => {
  const { theme } = useTheme();
  return <MainApp />;
};