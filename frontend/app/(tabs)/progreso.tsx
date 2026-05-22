import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

export default function ProgressScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Progreso</Text>
        <Text style={styles.description}>Aqui veremos tu avance con las recetas.</Text>
      </View>

      <View style={styles.panel}>
        <MaterialCommunityIcons name="chart-line" size={42} color="#1FA463" />
        <Text style={styles.panelTitle}>Work in progress</Text>
        <Text style={styles.panelText}>Los indicadores vivirán aquí sin meter ruido visual.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 18,
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 130,
    backgroundColor: '#FFFFFF',
  },
  description: {
    color: '#5F7F6E',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  header: {
    gap: 6,
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
  title: {
    color: '#123B2A',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },
});
