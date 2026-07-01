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
        name="fridge"
        options={{
          title: 'Refri',
        }}
      />
      <Tabs.Screen
        name="progreso"
        options={{
          title: 'Social',
        }}
      />
      <Tabs.Screen
        name="recipe"
        options={{
          title: 'Recetas',
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Calendario',
        }}
      />
    </Tabs>
  );
}
