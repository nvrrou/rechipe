import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

export default function TabOneScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <View style={styles.titleRow}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="home-outline" size={30} color="#FFFFFF" />
            </View>
            <View style={styles.titleCopy}>
              <Text style={styles.title}>Inicio</Text>
              <Text style={styles.subtitle}>Work in progress</Text>
            </View>
          </View>
        </View>

        <View style={styles.panel}>
          <MaterialCommunityIcons name="hammer-wrench" size={42} color="#4ADE80" />
          <Text style={styles.panelTitle}>Estamos cocinando esta vista</Text>
          <Text style={styles.panelText}>Pronto tendrá resumen de despensa, recetas y progreso.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0B',
  },
  content: {
    flex: 1,
    gap: 18,
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 130,
    backgroundColor: '#0B0B0B',
  },
  hero: {
    gap: 14,
    padding: 22,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#171717',
  },
  heroIcon: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#2A2A2A',
  },
  panel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 22,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#171717',
  },
  panelText: {
    maxWidth: 260,
    color: '#B8B8B8',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    textAlign: 'center',
  },
  panelTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: '#B8B8B8',
    fontSize: 15,
    fontWeight: '700',
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
  title: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },
});
