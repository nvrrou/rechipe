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
        <MaterialCommunityIcons name="chart-line" size={42} color="#00B86B" />
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
    backgroundColor: '#FBFFF8',
  },
  description: {
    color: '#2F7A4F',
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
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  panelText: {
    maxWidth: 260,
    color: '#2F7A4F',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    textAlign: 'center',
  },
  panelTitle: {
    color: '#064E2F',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  title: {
    color: '#064E2F',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },
});
