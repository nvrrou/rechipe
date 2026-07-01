import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { useAuth } from '@/contexts/AuthContext';
import { useThemePreference } from '@/contexts/ThemeContext';

const NAVBAR_HORIZONTAL_PADDING = 10;
const ACTIVE_INDICATOR_SIZE = 46;

const TAB_CONFIG: Record<string, { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = {
  fridge: { label: 'Refri', icon: 'fridge-outline' },
  progreso: { label: 'Social', icon: 'account-group-outline' },
  recipe: { label: 'Recetas', icon: 'chef-hat' },
  index: { label: 'Calendario', icon: 'calendar-week-outline' },
};

type NavbarRoute = {
  key: string;
  name: string;
  params?: object;
};

type NavbarProps = Partial<BottomTabBarProps> & {
  noSelection?: boolean;
};

export function Navbar({ state, descriptors, navigation, noSelection = false }: NavbarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { colorScheme } = useThemePreference();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [navbarWidth, setNavbarWidth] = useState(0);
  const slideAnim = useRef(new Animated.Value(320)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const indicatorPresenceAnim = useRef(new Animated.Value(1)).current;
  const activeRouteName = noSelection ? undefined : state?.routes[state.index]?.name;

  const visibleRoutes: NavbarRoute[] = state
    ? state.routes.filter((route) => TAB_CONFIG[route.name])
    : Object.keys(TAB_CONFIG).map((name) => ({ key: `standalone-${name}`, name }));
  const activeRouteKey = noSelection ? undefined : state?.routes[state.index]?.key;
  const activeVisibleIndex = visibleRoutes.findIndex((route) => route.key === activeRouteKey);
  const showActiveIndicator = activeVisibleIndex >= 0;
  const itemCount = visibleRoutes.length + 1;
  const contentWidth = navbarWidth > 0 ? navbarWidth - NAVBAR_HORIZONTAL_PADDING * 2 : 0;
  const itemWidth = contentWidth > 0 ? contentWidth / itemCount : 0;
  const indicatorWidth = ACTIVE_INDICATOR_SIZE;

  function getIndicatorX(index: number) {
    if (itemWidth <= 0) {
      return 0;
    }

    return NAVBAR_HORIZONTAL_PADDING + index * itemWidth + (itemWidth - indicatorWidth) / 2;
  }

  function moveIndicator(index: number) {
    Animated.spring(indicatorAnim, {
      toValue: getIndicatorX(index),
      damping: 18,
      mass: 0.7,
      stiffness: 190,
      useNativeDriver: true,
    }).start();
  }

  useEffect(() => {
    if (menuOpen) {
      setIsVisible(true);

      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();

      return;
    }

    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 320,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setIsVisible(false);
      }
    });
  }, [backdropAnim, menuOpen, slideAnim]);

  useEffect(() => {
    if (showActiveIndicator) {
      moveIndicator(activeVisibleIndex);
    }

    Animated.timing(indicatorPresenceAnim, {
      toValue: showActiveIndicator ? 1 : 0,
      duration: showActiveIndicator ? 180 : 160,
      easing: showActiveIndicator ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeVisibleIndex, indicatorPresenceAnim, itemWidth, showActiveIndicator]);

  function openMenu() {
    setMenuOpen(true);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  function openConfig() {
    closeMenu();
    router.push('/(navbarnt)/config');
  }

  function openProfile() {
    closeMenu();
    router.push('/(navbarnt)/perfil');
  }

  function navigateStandalone(routeName: string) {
    if (routeName === 'index') {
      router.replace('/(tabs)');
      return;
    }

    router.replace(`/(tabs)/${routeName}` as never);
  }

  const profileInitial = (user?.nombre || user?.email || 'U').trim().charAt(0).toUpperCase();
  const profileName = user?.nombre || 'Usuario';
  const profileEmail = user?.email || 'Sin correo';
  const isDark = colorScheme === 'dark';
  const darkIconColor = isDark ? '#EAFBF0' : '#064E2F';
  const darkSecondaryIconColor = isDark ? '#BDF7D2' : '#2F7A4F';

  return (
    <>
      <Modal transparent visible={isVisible} onRequestClose={closeMenu}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
          <Pressable style={styles.backdropPressable} onPress={closeMenu} />

          <Animated.View
            style={[
              styles.sidePanel,
              isDark && styles.sidePanelDark,
              {
                paddingTop: Math.max(insets.top + 20, 64),
                transform: [{ translateX: slideAnim }],
              },
            ]}>
            <View style={styles.sideHeader}>
              <Text style={styles.sideTitle}>Mas opciones</Text>
              <Pressable accessibilityRole="button" onPress={closeMenu} style={[styles.closeButton, isDark && styles.closeButtonDark]}>
                <MaterialCommunityIcons name="close" size={24} color={darkIconColor} />
              </Pressable>
            </View>

            <Pressable accessibilityRole="button" onPress={openProfile} style={[styles.profileCard, isDark && styles.profileCardDark]}>
              <View style={[styles.avatar, isDark && styles.avatarDark]}>
                <Text style={styles.avatarText}>{profileInitial}</Text>
              </View>
              <View style={styles.profileCopy}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {profileName}
                </Text>
                <Text style={styles.profileEmail} numberOfLines={1}>
                  {profileEmail}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={darkSecondaryIconColor} />
            </Pressable>

            <View style={styles.optionsList}>
              <Pressable accessibilityRole="button" onPress={openConfig} style={[styles.optionButton, isDark && styles.optionButtonDark]}>
                <View style={[styles.optionIcon, isDark && styles.optionIconDark]}>
                  <MaterialCommunityIcons name="cog-outline" size={22} color={darkIconColor} />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={styles.optionText}>Configuracion</Text>
                  <Text style={styles.optionDescription}>Preferencias de la app</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={darkSecondaryIconColor} />
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>

      <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom + 10, 22) }]}>
        <BlurView
          experimentalBlurMethod="dimezisBlurView"
          intensity={10}
          tint="dark"
          style={styles.navbar}
          onLayout={(event) => setNavbarWidth(event.nativeEvent.layout.width)}>
          <View pointerEvents="none" style={styles.navbarTint} />
          {navbarWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.activeGlass,
                {
                  opacity: indicatorPresenceAnim,
                  width: indicatorWidth,
                  transform: [{ translateX: indicatorAnim }, { scale: indicatorPresenceAnim }],
                },
              ]}
            />
          )}

          {visibleRoutes.map((route, index) => {
            const isFocused = activeRouteKey === route.key;
            const config = TAB_CONFIG[route.name];

            if (!config) {
              return null;
            }

            const onPress = () => {
              if (!navigation) {
                navigateStandalone(route.name);
                return;
              }

              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              if (!navigation) return;

              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            const tabColor = isFocused ? '#04c876' : '#3ca76b';

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={descriptors?.[route.key]?.options.tabBarAccessibilityLabel || config.label}
                onLongPress={onLongPress}
                onPress={onPress}
                style={styles.iconButton}>
                <MaterialCommunityIcons name={config.icon} size={26} color={tabColor} />
              </Pressable>
            );
          })}

          <Pressable
            accessibilityRole="button"
            onPress={openMenu}
            style={styles.iconButton}>
            <MaterialCommunityIcons name="menu" size={26} color="#3ca76b" />
          </Pressable>
        </BlurView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  activeGlass: {
    position: 'absolute',
    left: 0,
    top: 8,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(0, 184, 107, 0.48)',
    backgroundColor: 'rgba(244, 250, 246, 0.95)',
    shadowColor: '#00B86B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 78, 47, 0.16)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  avatar: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#74D997',
  },
  avatarDark: {
    backgroundColor: '#245C38',
  },
  avatarText: {
    color: '#0e6f45',
    fontSize: 22,
    fontWeight: '900',
  },
  closeButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#74D997',
  },
  closeButtonDark: {
    backgroundColor: '#245C38',
  },
  iconButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    minWidth: 0,
    backgroundColor: 'transparent',
  },
  navbar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0, 184, 107, 0.28)',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    shadowColor: '#00B86B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.26,
    shadowRadius: 30,
    elevation: 10,
    overflow: 'hidden',
  },
  navbarTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(225, 250, 240, 0.72)',
    borderRadius: 999,
  },
  optionButton: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#74D997',
    backgroundColor: '#E9FBEF',
    shadowColor: '#74D997',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 2,
  },
  optionButtonDark: {
    borderColor: '#2F7A4F',
    backgroundColor: '#102619',
    shadowColor: '#07130D',
  },
  optionCopy: {
    flex: 1,
    gap: 2,
    backgroundColor: 'transparent',
  },
  optionDescription: {
    color: '#45b174',
    fontSize: 13,
    fontWeight: '700',
  },
  optionIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#74D997',
  },
  optionIconDark: {
    backgroundColor: '#245C38',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#064E2F',
  },
  optionsList: {
    gap: 12,
    backgroundColor: 'transparent',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#74D997',
    backgroundColor: '#E9FBEF',
    marginBottom: 18,
    shadowColor: '#74D997',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.26,
    shadowRadius: 20,
    elevation: 2,
  },
  profileCardDark: {
    borderColor: '#2F7A4F',
    backgroundColor: '#102619',
    shadowColor: '#07130D',
  },
  profileCopy: {
    flex: 1,
    gap: 3,
    backgroundColor: 'transparent',
  },
  profileEmail: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '700',
  },
  profileName: {
    color: '#064E2F',
    fontSize: 17,
    fontWeight: '900',
  },
  sideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  sidePanel: {
    transform: [{ translateX: 320 }],
    width: '82%',
    maxWidth: 320,
    height: '100%',
    paddingHorizontal: 20,
    paddingBottom: 32,
    backgroundColor: '#FBFFF8',
    shadowColor: '#74D997',
    shadowOffset: { width: -8, height: 0 },
    shadowOpacity: 0.34,
    shadowRadius: 24,
    elevation: 12,
  },
  sidePanelDark: {
    backgroundColor: '#07130D',
    shadowColor: '#000000',
  },
  sideTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#064E2F',
  },
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 10,
    backgroundColor: 'transparent',
  },
});
