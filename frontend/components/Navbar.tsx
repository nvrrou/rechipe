import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';

const MENU_OPTIONS = ['Op 1', 'Op 2', 'Op 3'];

const TAB_CONFIG: Record<string, { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = {
  index: { label: 'Inicio', icon: 'home-outline' },
  fridge: { label: 'Refri', icon: 'fridge-outline' },
  recipe: { label: 'Receta', icon: 'chef-hat' },
  progreso: { label: 'Progreso', icon: 'food-apple-outline' },
};

export function Navbar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [navbarWidth, setNavbarWidth] = useState(0);
  const slideAnim = useRef(new Animated.Value(320)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const indicatorAnim = useRef(new Animated.Value(0)).current;

  const visibleRoutes = state.routes.filter((route) => TAB_CONFIG[route.name]);
  const activeRouteKey = state.routes[state.index]?.key;
  const activeVisibleIndex = Math.max(
    visibleRoutes.findIndex((route) => route.key === activeRouteKey),
    0
  );
  const menuIndex = visibleRoutes.length;
  const itemCount = visibleRoutes.length + 1;
  const itemWidth = navbarWidth > 0 ? navbarWidth / itemCount : 0;
  const indicatorWidth = itemWidth > 0 ? Math.min(Math.max(itemWidth - 18, 48), 58) : 52;

  function getIndicatorX(index: number) {
    if (itemWidth <= 0) {
      return 0;
    }

    return index * itemWidth + (itemWidth - indicatorWidth) / 2;
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

  function moveIndicatorFromTouch(locationX: number) {
    if (itemWidth <= 0) {
      return;
    }

    const nextIndex = Math.min(Math.max(Math.floor(locationX / itemWidth), 0), itemCount - 1);
    moveIndicator(nextIndex);
  }

  function openMenu() {
    setMenuOpen(true);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

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
                <MaterialCommunityIcons name="close" size={24} color="#0F172A" />
              </Pressable>
            </View>

            <View style={styles.optionsList}>
              {MENU_OPTIONS.map((option) => (
                <Pressable key={option} style={styles.optionButton}>
                  <Text style={styles.optionText}>{option}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>

      <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom + 10, 22) }]}>
        <View
          style={styles.navbar}
          onLayout={(event) => setNavbarWidth(event.nativeEvent.layout.width)}
          onTouchMove={(event) => moveIndicatorFromTouch(event.nativeEvent.locationX)}
          onTouchStart={(event) => moveIndicatorFromTouch(event.nativeEvent.locationX)}>
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
              moveIndicator(index);

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

            const isRecipeTab = route.name === 'recipe';
            const tabColor = isFocused ? '#0F172A' : '#475569';

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={descriptors[route.key].options.tabBarAccessibilityLabel}
                onLongPress={onLongPress}
                onPress={onPress}
                onPressIn={() => moveIndicator(index)}
                style={[styles.iconButton, isRecipeTab && styles.centerButton]}>
                <MaterialCommunityIcons name={config.icon} size={isRecipeTab ? 32 : 26} color={tabColor} />
              </Pressable>
            );
          })}

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              moveIndicator(menuIndex);
              openMenu();
            }}
            onPressIn={() => moveIndicator(menuIndex)}
            style={styles.iconButton}>
            <MaterialCommunityIcons name="menu" size={28} color="#475569" />
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  activeGlass: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.88)',
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    shadowColor: '#CBD5E1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  closeButton: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },
  centerButton: {
    transform: [{ translateY: -7 }],
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
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 10,
    overflow: 'hidden',
  },
  optionButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  optionsList: {
    gap: 12,
    backgroundColor: 'transparent',
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
    backgroundColor: '#F8FAFC',
    shadowColor: '#0F172A',
    shadowOffset: { width: -8, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
  },
  sideTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 30,
    paddingTop: 10,
    backgroundColor: 'transparent',
  },
});
