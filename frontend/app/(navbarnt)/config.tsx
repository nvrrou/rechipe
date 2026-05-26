import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

export default function ConfigScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.titleRow}>
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
              <MaterialCommunityIcons name="chevron-left" size={24} color="#064E2F" />
            </Pressable>
            <View style={styles.titleCopy}>
              <Text style={styles.title}>Configuracion</Text>
              <Text style={styles.subtitle}>Pantalla reservada para preferencias de la app.</Text>
            </View>
          </View>
        </View>

        <View style={styles.panel}>
          <MaterialCommunityIcons name="cog-outline" size={34} color="#2F7A4F" />
          <Text style={styles.emptyTitle}>Sin ajustes por ahora</Text>
          <Text style={styles.emptyText}>Aqui podemos agregar opciones cuando las necesites.</Text>
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
  emptyText: {
    color: '#2F7A4F',
    fontSize: 15,
    textAlign: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#FBFFF8',
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
});
