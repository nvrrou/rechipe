import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';

type IngredientCategory = {
  id: string;
  name: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  ingredients: IngredientItem[];
};

type IngredientItem = {
  id: string;
  name: string;
  imageUri: string;
};

function createIngredient(name: string): IngredientItem {
  const label = encodeURIComponent(name.trim().slice(0, 2).toUpperCase());

  return {
    id: `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    imageUri: `https://placehold.co/96x96/2a2a2a/ffffff/png?text=${label}`,
  };
}

const INITIAL_CATEGORIES: IngredientCategory[] = [
  {
    id: 'aderezos',
    name: 'Aderezos',
    icon: 'bottle-tonic-outline',
    color: '#F97316',
    ingredients: ['Mayonesa', 'Mostaza', 'Salsa de soya'].map(createIngredient),
  },
  {
    id: 'vegetales',
    name: 'Vegetales',
    icon: 'carrot',
    color: '#16A34A',
    ingredients: ['Tomate', 'Cebolla', 'Zanahoria'].map(createIngredient),
  },
  {
    id: 'frutas',
    name: 'Frutas',
    icon: 'fruit-cherries',
    color: '#DC2626',
    ingredients: ['Manzana', 'Platano', 'Limon'].map(createIngredient),
  },
  {
    id: 'legumbres',
    name: 'Legumbres',
    icon: 'seed-outline',
    color: '#A16207',
    ingredients: ['Garbanzos', 'Lentejas', 'Porotos'].map(createIngredient),
  },
  {
    id: 'carnes',
    name: 'Carnes',
    icon: 'food-steak',
    color: '#BE123C',
    ingredients: ['Pollo', 'Carne molida', 'Jamon'].map(createIngredient),
  },
  {
    id: 'mariscos',
    name: 'Mariscos',
    icon: 'waves',
    color: '#0891B2',
    ingredients: ['Camarones', 'Choritos', 'Ostiones'].map(createIngredient),
  },
  {
    id: 'pescado',
    name: 'Pescado',
    icon: 'fish',
    color: '#2563EB',
    ingredients: ['Reineta', 'Salmon', 'Atun'].map(createIngredient),
  },
  {
    id: 'cereales',
    name: 'Cereales',
    icon: 'barley',
    color: '#CA8A04',
    ingredients: ['Arroz', 'Avena', 'Quinoa'].map(createIngredient),
  },
];

export default function FridgeScreen() {
  const [categories, setCategories] = useState(INITIAL_CATEGORIES);
  const [ingredient, setIngredient] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(INITIAL_CATEGORIES[0].id);
  const [activeView, setActiveView] = useState<'categories' | 'category' | 'add'>('categories');

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? categories[0],
    [categories, selectedCategoryId]
  );

  function addIngredient(categoryId = selectedCategory.id) {
    const nextIngredient = ingredient.trim();

    if (!nextIngredient) {
      return;
    }

    setCategories((currentCategories) =>
      currentCategories.map((category) => {
        if (category.id !== categoryId) {
          return category;
        }

        return {
          ...category,
          ingredients: [createIngredient(nextIngredient), ...category.ingredients],
        };
      })
    );
    setIngredient('');
  }

  function openCategory(categoryId: string) {
    setSelectedCategoryId(categoryId);
    setActiveView('category');
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.titleRow}>
            {activeView !== 'categories' && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setActiveView('categories')}
                style={styles.inlineBackButton}>
                <MaterialCommunityIcons name="chevron-left" size={24} color="#FFFFFF" />
              </Pressable>
            )}
            <Text style={styles.title}>
              {activeView === 'category' ? selectedCategory.name : activeView === 'add' ? 'Agregar' : 'Tu refri'}
            </Text>
          </View>
          <Text style={styles.subtitle}>
            {activeView === 'category'
              ? 'Ingredientes categorizados en esta seccion.'
              : activeView === 'add'
                ? 'Elige una categoria y guarda el ingrediente donde corresponde.'
              : 'Elige una categoria para revisar y agregar ingredientes.'}
          </Text>
        </View>

        {activeView === 'categories' ? (
          <View style={styles.addBar}>
            <Pressable accessibilityRole="button" onPress={() => setActiveView('add')} style={styles.addButton}>
              <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.addBarText}>Agregar ingrediente</Text>
            <Pressable accessibilityRole="button" style={styles.searchButton}>
              <MaterialCommunityIcons name="magnify" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : (
          <View style={styles.addBar}>
            <Pressable accessibilityRole="button" onPress={() => addIngredient()} style={styles.addButton}>
              <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
            </Pressable>
            <TextInput
              onChangeText={setIngredient}
              onSubmitEditing={() => addIngredient()}
              placeholder={`Agregar a ${selectedCategory.name.toLowerCase()}`}
              placeholderTextColor="#9CA3AF"
              returnKeyType="done"
              style={styles.input}
              value={ingredient}
            />
            <Pressable accessibilityRole="button" style={styles.searchButton}>
              <MaterialCommunityIcons name="magnify" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        )}

        {activeView === 'categories' ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Categorias</Text>
              <Text style={styles.sectionMeta}>{categories.length} grupos</Text>
            </View>

            <View style={styles.categoryGrid}>
              {categories.map((category) => (
                <Pressable
                  accessibilityRole="button"
                  key={category.id}
                  onPress={() => openCategory(category.id)}
                  style={styles.categoryCard}>
                  <View style={styles.categoryIcon}>
                    <MaterialCommunityIcons name={category.icon} size={24} color="#FFFFFF" />
                  </View>
                  <View style={styles.categoryInfoRow}>
                    <View style={styles.categoryCopy}>
                      <Text style={styles.categoryName}>{category.name}</Text>
                      <Text style={styles.categoryCount}>{category.ingredients.length} ingredientes</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={22} color="#9CA3AF" />
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        ) : activeView === 'add' ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Agregar en</Text>
              <Text style={styles.sectionMeta}>{selectedCategory.name}</Text>
            </View>

            <View style={styles.categoryGrid}>
              {categories.map((category) => {
                const isSelected = category.id === selectedCategory.id;

                return (
                  <Pressable
                    accessibilityRole="button"
                    key={category.id}
                    onPress={() => setSelectedCategoryId(category.id)}
                    style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}>
                    <View style={[styles.categoryIcon, isSelected && styles.categoryIconSelected]}>
                      <MaterialCommunityIcons
                        name={category.icon}
                        size={24}
                        color="#FFFFFF"
                      />
                    </View>
                    <View style={styles.categoryCopy}>
                      <Text style={styles.categoryName}>{category.name}</Text>
                      <Text style={styles.categoryCount}>{category.ingredients.length} ingredientes</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <View style={styles.detailPanel}>
            <View style={styles.detailHeader}>
              <View style={styles.detailIcon}>
                <MaterialCommunityIcons name={selectedCategory.icon} size={26} color="#FFFFFF" />
              </View>
              <View style={styles.detailCopy}>
                <Text style={styles.detailTitle}>{selectedCategory.name}</Text>
                <Text style={styles.detailSubtitle}>
                  {selectedCategory.ingredients.length} ingredientes en esta categoria.
                </Text>
              </View>
            </View>

            <View style={styles.ingredientsList}>
              {selectedCategory.ingredients.map((item) => (
                <View key={item.id} style={styles.ingredientCard}>
                  <Image source={{ uri: item.imageUri }} style={styles.ingredientImage} />
                  <View style={styles.ingredientLabel}>
                    <Text style={styles.ingredientText} numberOfLines={2}>
                      {item.name}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#171717',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 2,
  },
  addButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#2A2A2A',
  },
  addBarText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  categoryCard: {
    width: '48%',
    minHeight: 118,
    padding: 14,
    gap: 12,
    justifyContent: 'space-between',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#171717',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 1,
  },
  categoryCardSelected: {
    borderColor: '#FFFFFF',
    backgroundColor: '#232323',
  },
  categoryCopy: {
    gap: 3,
    backgroundColor: 'transparent',
  },
  categoryCount: {
    color: '#B8B8B8',
    fontSize: 13,
    fontWeight: '600',
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
    borderRadius: 14,
    backgroundColor: '#2A2A2A',
  },
  categoryIconSelected: {
    backgroundColor: '#3A3A3A',
  },
  categoryInfoRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: 'transparent',
  },
  categoryName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  container: {
    flex: 1,
    backgroundColor: '#0B0B0B',
  },
  content: {
    gap: 18,
    paddingHorizontal: 20,
    paddingTop: 54,
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
    borderRadius: 16,
    backgroundColor: '#2A2A2A',
  },
  detailPanel: {
    gap: 16,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#171717',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 2,
  },
  detailSubtitle: {
    color: '#B8B8B8',
    fontSize: 14,
    fontWeight: '600',
  },
  detailTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  hero: {
    gap: 14,
    padding: 22,
    borderRadius: 26,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 2,
  },
  ingredientCard: {
    width: '30%',
    minWidth: 84,
    gap: 8,
    padding: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#171717',
  },
  ingredientImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#2A2A2A',
  },
  ingredientLabel: {
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  ingredientText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
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
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    paddingVertical: 12,
  },
  inlineBackButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#2A2A2A',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  sectionMeta: {
    color: '#B8B8B8',
    fontSize: 13,
    fontWeight: '800',
  },
  searchButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#2A2A2A',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  subtitle: {
    color: '#B8B8B8',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  title: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
});
