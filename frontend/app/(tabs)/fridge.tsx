import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';

type IngredientCategory = {
  id: string;
  name: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  ingredients: string[];
};

const INITIAL_CATEGORIES: IngredientCategory[] = [
  {
    id: 'aderezos',
    name: 'Aderezos',
    icon: 'bottle-tonic-outline',
    color: '#F97316',
    ingredients: ['Mayonesa', 'Mostaza', 'Salsa de soya'],
  },
  {
    id: 'vegetales',
    name: 'Vegetales',
    icon: 'carrot',
    color: '#16A34A',
    ingredients: ['Tomate', 'Cebolla', 'Zanahoria'],
  },
  {
    id: 'frutas',
    name: 'Frutas',
    icon: 'fruit-cherries',
    color: '#DC2626',
    ingredients: ['Manzana', 'Platano', 'Limon'],
  },
  {
    id: 'legumbres',
    name: 'Legumbres',
    icon: 'seed-outline',
    color: '#A16207',
    ingredients: ['Garbanzos', 'Lentejas', 'Porotos'],
  },
  {
    id: 'carnes',
    name: 'Carnes',
    icon: 'food-steak',
    color: '#BE123C',
    ingredients: ['Pollo', 'Carne molida', 'Jamon'],
  },
  {
    id: 'mariscos',
    name: 'Mariscos',
    icon: 'waves',
    color: '#0891B2',
    ingredients: ['Camarones', 'Choritos', 'Ostiones'],
  },
  {
    id: 'pescado',
    name: 'Pescado',
    icon: 'fish',
    color: '#2563EB',
    ingredients: ['Reineta', 'Salmon', 'Atun'],
  },
  {
    id: 'cereales',
    name: 'Cereales',
    icon: 'barley',
    color: '#CA8A04',
    ingredients: ['Arroz', 'Avena', 'Quinoa'],
  },
];

export default function FridgeScreen() {
  const [categories, setCategories] = useState(INITIAL_CATEGORIES);
  const [ingredient, setIngredient] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(INITIAL_CATEGORIES[0].id);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? categories[0],
    [categories, selectedCategoryId]
  );

  function addIngredient() {
    const nextIngredient = ingredient.trim();

    if (!nextIngredient) {
      return;
    }

    setCategories((currentCategories) =>
      currentCategories.map((category) => {
        if (category.id !== selectedCategory.id) {
          return category;
        }

        return {
          ...category,
          ingredients: [nextIngredient, ...category.ingredients],
        };
      })
    );
    setIngredient('');
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Mi refri</Text>
          <Text style={styles.title}>Ingredientes disponibles</Text>
        </View>

        <View style={styles.addBar}>
          <MaterialCommunityIcons name="plus-circle-outline" size={24} color="#2563EB" />
          <TextInput
            onChangeText={setIngredient}
            onSubmitEditing={addIngredient}
            placeholder={`Agregar a ${selectedCategory.name.toLowerCase()}`}
            placeholderTextColor="#94A3B8"
            returnKeyType="done"
            style={styles.input}
            value={ingredient}
          />
          <Pressable accessibilityRole="button" onPress={addIngredient} style={styles.addButton}>
            <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Categorias</Text>
          <Text style={styles.sectionMeta}>2 columnas</Text>
        </View>

        <View style={styles.categoryGrid}>
          {categories.map((category) => {
            const isSelected = category.id === selectedCategory.id;

            return (
              <Pressable
                accessibilityRole="button"
                key={category.id}
                onPress={() => setSelectedCategoryId(category.id)}
                style={[styles.categoryCard, isSelected && styles.categoryCardActive]}>
                <View style={[styles.categoryIcon, { backgroundColor: `${category.color}1A` }]}>
                  <MaterialCommunityIcons name={category.icon} size={24} color={category.color} />
                </View>
                <View style={styles.categoryCopy}>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  <Text style={styles.categoryCount}>{category.ingredients.length} ingredientes</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color="#94A3B8" />
              </Pressable>
            );
          })}
        </View>

        <View style={styles.detailPanel}>
          <View style={styles.detailHeader}>
            <View style={[styles.detailIcon, { backgroundColor: `${selectedCategory.color}1A` }]}>
              <MaterialCommunityIcons name={selectedCategory.icon} size={26} color={selectedCategory.color} />
            </View>
            <View style={styles.detailCopy}>
              <Text style={styles.detailTitle}>{selectedCategory.name}</Text>
              <Text style={styles.detailSubtitle}>Toca una categoria para ver su contenido.</Text>
            </View>
          </View>

          <View style={styles.ingredientsList}>
            {selectedCategory.ingredients.map((item) => (
              <View key={item} style={styles.ingredientPill}>
                <Text style={styles.ingredientText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  addBar: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D8E3F0',
    backgroundColor: '#FFFFFF',
    shadowColor: '#CBD5E1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 4,
  },
  addButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#2563EB',
  },
  categoryCard: {
    width: '48%',
    minHeight: 118,
    padding: 14,
    justifyContent: 'space-between',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  categoryCardActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  categoryCopy: {
    gap: 3,
    backgroundColor: 'transparent',
  },
  categoryCount: {
    color: '#64748B',
    fontSize: 13,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    backgroundColor: 'transparent',
  },
  categoryIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  categoryName: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    gap: 18,
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 130,
  },
  detailCopy: {
    flex: 1,
    gap: 3,
    backgroundColor: 'transparent',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  detailIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  detailPanel: {
    gap: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  detailSubtitle: {
    color: '#64748B',
    fontSize: 14,
  },
  detailTitle: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '800',
  },
  eyebrow: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  header: {
    gap: 6,
    backgroundColor: 'transparent',
  },
  ingredientPill: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  ingredientText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  ingredientsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'transparent',
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  sectionMeta: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
  },
  title: {
    color: '#0F172A',
    fontSize: 30,
    fontWeight: '800',
  },
});
