import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { useAuth } from '@/contexts/AuthContext';

const NAVBAR_HORIZONTAL_PADDING = 10;
const ACTIVE_INDICATOR_SIZE = 46;

const TAB_CONFIG: Record<string, { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = {
  index: { label: 'Inicio', icon: 'home-outline' },
  fridge: { label: 'Refri', icon: 'fridge-outline' },
  recipe: { label: 'Receta', icon: 'chef-hat' },
  progreso: { label: 'Progreso', icon: 'food-apple-outline' },
};

export function Navbar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [navbarWidth, setNavbarWidth] = useState(0);
  const slideAnim = useRef(new Animated.Value(320)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const activeRouteName = state.routes[state.index]?.name; // Ruta activa actual

  const visibleRoutes = state.routes.filter((route) => TAB_CONFIG[route.name]);
  const activeRouteKey = state.routes[state.index]?.key;
  const activeVisibleIndex = Math.max(
    visibleRoutes.findIndex((route) => route.key === activeRouteKey),
    0
  );
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
    moveIndicator(activeVisibleIndex);
  }, [activeVisibleIndex, itemWidth]);

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

  function openList() {
    closeMenu();
    router.push('/(navbarnt)/lista');
  }

  const profileInitial = (user?.nombre || user?.email || 'U').trim().charAt(0).toUpperCase();
  const profileName = user?.nombre || 'Usuario';
  const profileEmail = user?.email || 'Sin correo';

  return (
    <>
      <Modal transparent visible={isVisible} onRequestClose={closeMenu}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
          <Pressable style={styles.backdropPressable} onPress={closeMenu} />

          <Animated.View
            style={[
              styles.sidePanel,
              {
                paddingTop: Math.max(insets.top + 20, 64),
                transform: [{ translateX: slideAnim }],
              },
            ]}>
            <View style={styles.sideHeader}>
              <Text style={styles.sideTitle}>Mas opciones</Text>
              <Pressable accessibilityRole="button" onPress={closeMenu} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={24} color="#123B2A" />
              </Pressable>
            </View>

            <Pressable accessibilityRole="button" onPress={openProfile} style={styles.profileCard}>
              <View style={styles.avatar}>
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
              <MaterialCommunityIcons name="chevron-right" size={22} color="#5F7F6E" />
            </Pressable>

            <View style={styles.optionsList}>
              <Pressable accessibilityRole="button" onPress={openList} style={styles.optionButton}>
                <View style={styles.optionIcon}>
                  <MaterialCommunityIcons name="clipboard-list-outline" size={22} color="#123B2A" />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={styles.optionText}>Test lista</Text>
                  <Text style={styles.optionDescription}>Ir a lista de compras</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color="#5F7F6E" />
              </Pressable>

              <Pressable accessibilityRole="button" onPress={openConfig} style={styles.optionButton}>
                <View style={styles.optionIcon}>
                  <MaterialCommunityIcons name="cog-outline" size={22} color="#123B2A" />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={styles.optionText}>Configuracion</Text>
                  <Text style={styles.optionDescription}>Preferencias de la app</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color="#5F7F6E" />
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>

      <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom + 10, 22) }]}>
        <BlurView
          experimentalBlurMethod="dimezisBlurView"
          intensity={30}
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
                  width: indicatorWidth,
                  transform: [{ translateX: indicatorAnim }],
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
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            const tabColor = isFocused ? '#1FA463' : '#7AA28A';

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={descriptors[route.key].options.tabBarAccessibilityLabel}
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
            <MaterialCommunityIcons name="menu" size={26} color="#168A50" />
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
    borderColor: 'rgba(31, 164, 99, 0.42)',
    backgroundColor: 'rgba(231, 247, 236, 0.86)',
    shadowColor: '#1FA463',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(18, 59, 42, 0.18)',
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
    backgroundColor: '#CDE8D5',
  },
  avatarText: {
    color: '#123B2A',
    fontSize: 22,
    fontWeight: '900',
  },
  closeButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#CDE8D5',
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
    borderColor: 'rgba(31, 164, 99, 0.22)',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    shadowColor: '#A9DDB8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 28,
    elevation: 10,
    overflow: 'hidden',
  },
  navbarTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
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
    borderColor: '#CDE8D5',
    backgroundColor: '#F4FBF5',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 2,
  },
  optionCopy: {
    flex: 1,
    gap: 2,
    backgroundColor: 'transparent',
  },
  optionDescription: {
    color: '#5F7F6E',
    fontSize: 13,
    fontWeight: '700',
  },
  optionIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#CDE8D5',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#123B2A',
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
    borderColor: '#CDE8D5',
    backgroundColor: '#F4FBF5',
    marginBottom: 18,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.26,
    shadowRadius: 20,
    elevation: 2,
  },
  profileCopy: {
    flex: 1,
    gap: 3,
    backgroundColor: 'transparent',
  },
  profileEmail: {
    color: '#5F7F6E',
    fontSize: 13,
    fontWeight: '700',
  },
  profileName: {
    color: '#123B2A',
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
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: -8, height: 0 },
    shadowOpacity: 0.34,
    shadowRadius: 24,
    elevation: 12,
  },
  sideTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#123B2A',
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
