import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider } from '@/contexts/AuthContext';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(auth)',
};

SplashScreen.preventAutoHideAsync();

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSegments } from 'expo-router';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ProtectedLayout>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          </Stack>
        </ThemeProvider>
      </ProtectedLayout>
    </AuthProvider>
  );
}

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user, pendingCredentials } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isLogin = segments[1] === 'login';
    const isCompletingProfile = segments[1] === 'completar_perfil';

    const hasPendingRegistration = !!user && !isAuthenticated && !!pendingCredentials;
    const hasIncompleteProfile =
      !!user &&
      isAuthenticated &&
      (!user.edad || !user.peso || !user.altura || !user.genero || user.objetivos.length === 0);

    if (hasPendingRegistration && !isCompletingProfile) {
      router.replace('/(auth)/completar_perfil');
      return;
    }

    if (hasIncompleteProfile && !isCompletingProfile) {
      router.replace('/(auth)/completar_perfil');
      return;
    }

    if (!isAuthenticated && !hasPendingRegistration && !isLogin) {
      router.replace('/(auth)/login');
      return;
    }

    if (isAuthenticated && inAuthGroup && !hasIncompleteProfile) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, pendingCredentials, router, segments, user]);

  return <>{children}</>;
}
