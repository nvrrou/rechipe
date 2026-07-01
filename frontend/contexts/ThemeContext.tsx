import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName, StyleSheet } from 'react-native';

export type AppThemeMode = 'system' | 'light' | 'dark';
export type AppColorScheme = 'light' | 'dark';

type ThemeContextValue = {
  colorScheme: AppColorScheme;
  mode: AppThemeMode;
  setMode: (mode: AppThemeMode) => Promise<void>;
};

const THEME_MODE_KEY = 'rechipe:theme-mode';
const ThemeContext = createContext<ThemeContextValue | null>(null);

let activeColorScheme: AppColorScheme = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
let preprocessorsRegistered = false;

const darkColorMap: Record<string, string> = {
  '#FBFFF8': '#07130D',
  '#F4FFF7': '#0B1C12',
  '#E9FBEF': '#102619',
  '#DDF8E7': '#173321',
  '#D8FBE3': '#183C27',
  '#D8FFE5': '#143721',
  '#BDEFCF': '#245C38',
  '#B8EEC8': '#245C38',
  '#B9FFD1': '#2D7B4B',
  '#9FE7B9': '#2F7A4F',
  '#74D997': '#36B779',
  '#43A66C': '#A7F3C4',
  '#2F7A4F': '#BDF7D2',
  '#065E38': '#D8FFE5',
  '#064E2F': '#EAFBF0',
  '#00B86B': '#20D684',
  '#00D976': '#2FE994',
  '#00E676': '#42F59C',
  '#FFFFFF': '#102619',
  '#F0FDF4': '#102619',
  '#EFF6FF': '#102033',
  '#F0F9FF': '#102033',
  '#E0F2FE': '#13324A',
  '#BAE6FD': '#205270',
  '#FFF7ED': '#332012',
  '#FFEDD5': '#4A2D13',
  '#FEF2F2': '#351818',
  '#FEE2E2': '#4A1E1E',
  '#4B5563': '#CBD5E1',
  '#6B7280': '#CBD5E1',
  '#7AA28A': '#8EDBA9',
  '#94A3B8': '#CBD5E1',
};

const darkRgbaMap: Record<string, string> = {
  'rgba(244, 250, 246, 0.95)': 'rgba(7, 19, 13, 0.96)',
  'rgba(255, 255, 255, 0.96)': 'rgba(16, 38, 25, 0.96)',
  'rgba(225, 250, 240, 0.72)': 'rgba(16, 38, 25, 0.78)',
  'rgba(251, 255, 248, 0.82)': 'rgba(16, 38, 25, 0.84)',
  'rgba(251, 255, 248, 0.68)': 'rgba(16, 38, 25, 0.72)',
  'rgba(216, 255, 229, 0.24)': 'rgba(45, 123, 75, 0.28)',
  'rgba(159, 231, 185, 0.08)': 'rgba(159, 231, 185, 0.12)',
  'rgba(6, 78, 47, 0.16)': 'rgba(159, 231, 185, 0.18)',
  'rgba(6, 78, 47, 0.28)': 'rgba(159, 231, 185, 0.20)',
};

function normalizeColor(value: string) {
  return value.length === 7 ? value.toUpperCase() : value;
}

export function mapThemeColor(value: unknown, colorScheme: AppColorScheme = activeColorScheme) {
  if (colorScheme !== 'dark' || typeof value !== 'string') return value;
  const normalized = normalizeColor(value.trim());
  return darkColorMap[normalized] || darkRgbaMap[value.trim()] || value;
}

export function mapThemeStyle<T>(style: T, colorScheme: AppColorScheme): T {
  if (colorScheme !== 'dark' || !style) return style;

  const flattenedStyle = StyleSheet.flatten(style as any);
  if (!flattenedStyle || typeof flattenedStyle !== 'object') {
    return style;
  }

  const mappedStyle: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flattenedStyle as Record<string, unknown>)) {
    if (key === 'transform' && Array.isArray(value)) {
      mappedStyle[key] = value;
    } else if (typeof value === 'string') {
      mappedStyle[key] = mapThemeColor(value, colorScheme);
    } else {
      mappedStyle[key] = value;
    }
  }

  return mappedStyle as T;
}

function registerThemePreprocessors() {
  if (preprocessorsRegistered) return;
  preprocessorsRegistered = true;

  const register = (StyleSheet as any).setStyleAttributePreprocessor;
  if (typeof register !== 'function') return;

  ['backgroundColor', 'borderColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'color', 'shadowColor', 'textDecorationColor', 'tintColor'].forEach(
    (property) => register(property, mapThemeColor)
  );
}

function resolveColorScheme(mode: AppThemeMode, systemScheme: ColorSchemeName): AppColorScheme {
  if (mode === 'system') return systemScheme === 'dark' ? 'dark' : 'light';
  return mode;
}

registerThemePreprocessors();

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppThemeMode>('system');
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(Appearance.getColorScheme());

  useEffect(() => {
    AsyncStorage.getItem(THEME_MODE_KEY).then((storedMode) => {
      if (storedMode === 'light' || storedMode === 'dark' || storedMode === 'system') {
        setModeState(storedMode);
      }
    });

    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });

    return () => subscription.remove();
  }, []);

  const colorScheme = resolveColorScheme(mode, systemScheme);
  activeColorScheme = colorScheme;

  const setMode = async (nextMode: AppThemeMode) => {
    activeColorScheme = resolveColorScheme(nextMode, Appearance.getColorScheme());
    setModeState(nextMode);
    await AsyncStorage.setItem(THEME_MODE_KEY, nextMode);
  };

  const value = useMemo(
    () => ({
      colorScheme,
      mode,
      setMode,
    }),
    [colorScheme, mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreference() {
  const value = useContext(ThemeContext);
  if (!value) {
    return {
      colorScheme: (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light') as AppColorScheme,
      mode: 'system' as AppThemeMode,
      setMode: async () => {},
    };
  }
  return value;
}
