import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

export default function RecipeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Generar receta</Text>
      <Text style={styles.description}>Aqui despues podemos poner la magia para crear recetas.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  description: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
});
