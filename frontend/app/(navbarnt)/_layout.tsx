import { Stack } from 'expo-router';

export default function NavbarlessLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
