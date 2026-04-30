import { Tabs } from 'expo-router';

import { Navbar } from '@/components/Navbar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <Navbar {...props} />}
      screenOptions={{
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'Refri',
        }}
      />
      <Tabs.Screen
        name="recipe"
        options={{
          title: 'Receta',
        }}
      />
      <Tabs.Screen
        name="progreso"
        options={{
          title: 'Progreso',
        }}
      />
    </Tabs>
  );
}
