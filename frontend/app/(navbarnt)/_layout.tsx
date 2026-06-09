import { Stack } from 'expo-router';

import { View } from '@/components/Themed';
import { Navbar } from '@/components/Navbar';

export default function NavbarlessLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <Navbar noSelection />
    </View>
  );
}
