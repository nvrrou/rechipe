import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { AppThemeMode, useThemePreference } from '@/contexts/ThemeContext';

const THEME_OPTIONS: Array<{
  mode: AppThemeMode;
  label: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}> = [
  {
    mode: 'system',
    label: 'Sistema',
    description: 'Usa el modo configurado en tu dispositivo.',
    icon: 'theme-light-dark',
  },
  {
    mode: 'light',
    label: 'Claro',
    description: 'Mantiene la interfaz verde clara de Rechipe.',
    icon: 'white-balance-sunny',
  },
  {
    mode: 'dark',
    label: 'Oscuro',
    description: 'Baja el brillo en todas las vistas de la app.',
    icon: 'weather-night',
  },
];

export default function ConfigScreen() {
  const router = useRouter();
  const { colorScheme, mode, setMode } = useThemePreference();
  const isDark = colorScheme === 'dark';

  return (
    <SafeAreaView style={[styles.safeArea, isDark && styles.safeAreaDark]}>
      <View style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.hero}>
          <View style={styles.titleRow}>
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={[styles.backButton, isDark && styles.backButtonDark]}>
              <MaterialCommunityIcons name="chevron-left" size={24} color={isDark ? '#EAFBF0' : '#064E2F'} />
            </Pressable>
            <View style={styles.titleCopy}>
              <Text style={[styles.title, isDark && styles.titleDark]}>Configuracion</Text>
              <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>Ajusta como se ve Rechipe en este dispositivo.</Text>
            </View>
          </View>
        </View>

        <View style={[styles.panel, isDark && styles.panelDark]}>
          <View style={styles.panelHeader}>
            <View style={[styles.panelIcon, isDark && styles.panelIconDark]}>
              <MaterialCommunityIcons name="palette-outline" size={24} color={isDark ? '#EAFBF0' : '#064E2F'} />
            </View>
            <View style={styles.titleCopy}>
              <Text style={[styles.sectionTitle, isDark && styles.titleDark]}>Apariencia</Text>
              <Text style={[styles.emptyText, isDark && styles.subtitleDark]}>Modo activo: {isDark ? 'oscuro' : 'claro'}</Text>
            </View>
          </View>

          <View style={styles.optionList}>
            {THEME_OPTIONS.map((option) => {
              const selected = mode === option.mode;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={option.mode}
                  onPress={() => setMode(option.mode)}
                  style={[styles.optionRow, isDark && styles.optionRowDark, selected && styles.optionRowSelected]}>
                  <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
                    <MaterialCommunityIcons name={option.icon} size={21} color={selected ? '#FBFFF8' : isDark ? '#BDF7D2' : '#064E2F'} />
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={[styles.optionTitle, isDark && styles.titleDark]}>{option.label}</Text>
                    <Text style={[styles.optionDescription, isDark && styles.subtitleDark]}>{option.description}</Text>
                  </View>
                  {selected && <MaterialCommunityIcons name="check-circle" size={22} color="#00B86B" />}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#E9FBEF',
    shadowColor: '#74D997',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 2,
  },
  container: {
    flex: 1,
    gap: 18,
    paddingHorizontal: 20,
    paddingTop: 54,
    backgroundColor: '#FBFFF8',
  },
  containerDark: {
    backgroundColor: '#07130D',
  },
  emptyText: {
    color: '#2F7A4F',
    fontSize: 15,
  },
  emptyTitle: {
    color: '#064E2F',
    fontSize: 18,
    fontWeight: '900',
  },
  hero: {
    gap: 14,
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  panel: {
    gap: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  panelDark: {
    borderColor: '#2F7A4F',
    backgroundColor: '#102619',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  panelIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#DDF8E7',
  },
  panelIconDark: {
    backgroundColor: '#173321',
  },
  optionCopy: {
    flex: 1,
    gap: 3,
    backgroundColor: 'transparent',
  },
  optionDescription: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  optionIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#DDF8E7',
  },
  optionIconSelected: {
    backgroundColor: '#00B86B',
  },
  optionList: {
    gap: 10,
    backgroundColor: 'transparent',
  },
  optionRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BDEFCF',
    backgroundColor: '#FBFFF8',
  },
  optionRowDark: {
    borderColor: '#245C38',
    backgroundColor: '#07130D',
  },
  optionRowSelected: {
    borderColor: '#00B86B',
  },
  optionTitle: {
    color: '#064E2F',
    fontSize: 15,
    fontWeight: '900',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#FBFFF8',
  },
  safeAreaDark: {
    backgroundColor: '#07130D',
  },
  sectionTitle: {
    color: '#064E2F',
    fontSize: 18,
    fontWeight: '900',
  },
  subtitle: {
    color: '#2F7A4F',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  title: {
    color: '#064E2F',
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 36,
  },
  titleDark: {
    color: '#EAFBF0',
  },
  titleCopy: {
    flex: 1,
    gap: 5,
    backgroundColor: 'transparent',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  subtitleDark: {
    color: '#BDF7D2',
  },
  backButtonDark: {
    backgroundColor: '#102619',
    shadowColor: '#07130D',
  },
});
