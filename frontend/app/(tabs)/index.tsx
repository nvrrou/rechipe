import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

export default function TabOneScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.title}>Inicio</Text>
          <Text style={styles.subtitle}>Work in progress</Text>
        </View>

        <View style={styles.panel}>
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
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    gap: 18,
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 130,
    backgroundColor: '#FFFFFF',
  },
  hero: {
    gap: 14,
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  panel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 22,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#CDE8D5',
    backgroundColor: '#F4FBF5',
  },
  panelText: {
    maxWidth: 260,
    color: '#5F7F6E',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    textAlign: 'center',
  },
  panelTitle: {
    color: '#123B2A',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: '#5F7F6E',
    fontSize: 15,
    fontWeight: '700',
  },
  title: {
    color: '#123B2A',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },
});
