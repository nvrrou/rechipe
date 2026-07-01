import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemePreferenceProvider } from '@/contexts/ThemeContext';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(auth)',
};

import { useAuth } from '@/contexts/AuthContext';
import { Href, useRouter, useSegments } from 'expo-router';

const VERIFY_EMAIL_ROUTE = '/(auth)/verificar_correo' as Href;

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  return (
    <ThemePreferenceProvider>
      <ThemedRoot />
    </ThemePreferenceProvider>
  );
}

function ThemedRoot() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ProtectedLayout>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(navbarnt)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          </Stack>
          <IntroSplash colorScheme={colorScheme} />
        </ThemeProvider>
      </ProtectedLayout>
    </AuthProvider>
  );
}

function IntroSplash({ colorScheme }: { colorScheme: 'light' | 'dark' | null | undefined }) {
  const [visible, setVisible] = useState(true);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 1700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(500),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(scale, {
        toValue: 1,
        duration: 1700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => setVisible(false));
  }, [opacity, scale]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="auto"
      style={[
        styles.introSplash,
        { backgroundColor: isDark ? '#07130D' : '#FBFFF8', opacity },
      ]}>
      <Animated.Text
        style={[
          styles.introLogo,
          {
            color: isDark ? '#20D684' : '#00B86B',
            transform: [{ scale }],
          },
        ]}>
        Rechipe
      </Animated.Text>
    </Animated.View>
  );
}

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user, pendingCredentials, pendingVerificationEmail } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isLogin = segments[1] === 'login';
    const isCompletingProfile = segments[1] === 'completar_perfil';
    const currentRoute = segments[1] as string | undefined;
    const isVerifyingEmail = currentRoute === 'verificar_correo';

    const hasPendingRegistration = !!user && !isAuthenticated && !!pendingCredentials;
    const hasIncompleteProfile =
      !!user &&
      isAuthenticated &&
      (!user.edad || !user.peso || !user.altura || !user.genero || user.objetivos.length === 0);

    //Si hay un email pendiente de verificación, redirigir a la pantalla de verificacion
    if (pendingVerificationEmail && hasPendingRegistration && !isVerifyingEmail) {
      router.replace(VERIFY_EMAIL_ROUTE);
      return;
    }

    if (hasPendingRegistration && !isCompletingProfile && !isVerifyingEmail) {
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
  }, [isAuthenticated, isLoading, pendingCredentials, pendingVerificationEmail, router, segments, user]);

  return <>{children}</>;
}

const styles = StyleSheet.create({
  introLogo: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 0,
  },
  introSplash: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
});
