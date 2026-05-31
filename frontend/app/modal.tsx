import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

export default function ModalScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Modal</Text>
      <Text style={styles.description}>Vista auxiliar en progreso.</Text>

      {/* Use a light status bar on iOS to account for the black space above the modal */}
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 10,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FBFFF8',
  },
  description: {
    color: '#2F7A4F',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  title: {
    color: '#064E2F',
    fontSize: 34,
    fontWeight: '900',
  },
});
