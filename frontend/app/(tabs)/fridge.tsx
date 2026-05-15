import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useAuth } from '@/contexts/AuthContext';
import {
  DespensaItemData,
  agregarIngrediente,
  buscarIngredientes,
  eliminarIngrediente,
  fetchDespensa,
} from '@/services/despensa';

// Tipos de categoría 

type CategoryDef = {
  id: string;
  name: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
};

const CATEGORIES: CategoryDef[] = [
  { id: 'carnes', name: 'Carnes', icon: 'food-steak', color: '#BE123C' },
  { id: 'vegetales', name: 'Vegetales', icon: 'carrot', color: '#16A34A' },
  { id: 'frutas', name: 'Frutas', icon: 'fruit-cherries', color: '#DC2626' },
  { id: 'legumbres', name: 'Legumbres', icon: 'seed-outline', color: '#A16207' },
  { id: 'mariscos', name: 'Mariscos', icon: 'waves', color: '#0891B2' },
  { id: 'pescado', name: 'Pescado', icon: 'fish', color: '#2563EB' },
  { id: 'aderezos', name: 'Aderezos', icon: 'bottle-tonic-outline', color: '#F97316' },
  { id: 'cereales', name: 'Cereales', icon: 'barley', color: '#CA8A04' },
  { id: 'lacteos', name: 'Lácteos', icon: 'cup', color: '#7C3AED' },
  { id: 'otros', name: 'Otros', icon: 'dots-horizontal', color: '#6B7280' },
];

// Genera un placeholder de imagen con las primeras 2 letras
function getPlaceholderUri(name: string) {
  const label = encodeURIComponent(name.trim().slice(0, 2).toUpperCase());
  return `https://placehold.co/96x96/2a2a2a/ffffff/png?text=${label}`;
}

export default function FridgeScreen() {
  const { user } = useAuth();

  // Estado principal
  const [items, setItems] = useState<DespensaItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingLoading, setAddingLoading] = useState(false);

  // Input y navegación
  const [ingredient, setIngredient] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(CATEGORIES[0].id);
  const [activeView, setActiveView] = useState<'categories' | 'category' | 'add' | 'search'>('categories');

  // Busqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DespensaItemData[]>([]);
  const [searching, setSearching] = useState(false);

  // La categoria seleccionada actual
  const selectedCategory = useMemo(
    () => CATEGORIES.find((c) => c.id === selectedCategoryId) ?? CATEGORIES[0],
    [selectedCategoryId]
  );

  // Ingredientes agrupados por categoria
  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, DespensaItemData[]> = {};
    for (const cat of CATEGORIES) {
      grouped[cat.id] = [];
    }
    for (const item of items) {
      const catId = item.categoria?.toLowerCase() || 'otros';
      if (grouped[catId]) {
        grouped[catId].push(item);
      } else {
        grouped['otros'].push(item);
      }
    }
    return grouped;
  }, [items]);

  // Cargar datos al montar
  const loadDespensa = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const result = await fetchDespensa(user.id);
    if (result.items) {
      setItems(result.items);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    loadDespensa();
  }, [loadDespensa]);

  // ---------- Agregar ingrediente ----------
  async function handleAddIngredient(categoryId = selectedCategory.id) {
    const nombre = ingredient.trim();
    if (!nombre || !user?.id) return;

    setAddingLoading(true);
    const result = await agregarIngrediente({
      user_id: user.id,
      nombre_producto: nombre,
      categoria: categoryId,
    });

    if (result.error) {
      Alert.alert('Error', result.error);
    } else {
      // agregamos al estado local para ver el cambio inmediatamente
      setItems((prev) => [result, ...prev]);
      setIngredient('');
    }
    setAddingLoading(false);
  }

  // ---------- Eliminar ingrediente ----------
  async function handleDeleteIngredient(itemId: string) {
    Alert.alert(
      'Eliminar ingrediente',
      '¿Estás seguro de que quieres eliminar este ingrediente de tu despensa?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const result = await eliminarIngrediente(itemId);
            if (result.error) {
              Alert.alert('Error', result.error);
            } else {
              setItems((prev) => prev.filter((i) => i.id !== itemId));
            }
          },
        },
      ]
    );
  }

  // Busqueda
  async function handleSearch(query: string) {
    setSearchQuery(query);
    if (!query.trim() || !user?.id) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    const result = await buscarIngredientes(user.id, query.trim());
    if (result.items) {
      setSearchResults(result.items);
    }
    setSearching(false);
  }

  // Abrir categoria
  function openCategory(categoryId: string) {
    setSelectedCategoryId(categoryId);
    setActiveView('category');
  }

  // Render

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Cargando tu despensa...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.titleRow}>
            {/* Botón de volver si no estamos en la vista principal */}
            {activeView !== 'categories' && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setActiveView('categories');
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                style={styles.inlineBackButton}>
                <MaterialCommunityIcons name="chevron-left" size={24} color="#FFFFFF" />
              </Pressable>
            )}
            <Text style={styles.title}>
              {activeView === 'category'
                ? selectedCategory.name
                : activeView === 'add'
                  ? 'Agregar'
                  : activeView === 'search'
                    ? 'Buscar'
                    : 'Tu refri'}
            </Text>
          </View>
          <Text style={styles.subtitle}>
            {activeView === 'category'
              ? 'Ingredientes categorizados en esta seccion.'
              : activeView === 'add'
                ? 'Elige una categoria y guarda el ingrediente donde corresponde.'
                : activeView === 'search'
                  ? 'Busca ingredientes en tu despensa por nombre.'
                  : 'Elige una categoria para revisar y agregar ingredientes.'}
          </Text>
        </View>

        {/* Barra de accion */}
        {activeView === 'categories' ? (
          <View style={styles.addBar}>
            <Pressable accessibilityRole="button" onPress={() => setActiveView('add')} style={styles.addButton}>
              <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.addBarText}>Agregar ingrediente</Text>
            <Pressable accessibilityRole="button" onPress={() => setActiveView('search')} style={styles.searchButton}>
              <MaterialCommunityIcons name="magnify" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : activeView === 'search' ? (
          <View style={styles.addBar}>
            <View style={styles.searchIconStatic}>
              <MaterialCommunityIcons name="magnify" size={22} color="#9CA3AF" />
            </View>
            <TextInput
              onChangeText={handleSearch}
              placeholder="Buscar en tu despensa..."
              placeholderTextColor="#9CA3AF"
              returnKeyType="search"
              style={styles.input}
              value={searchQuery}
              autoFocus
            />
            {searching && <ActivityIndicator size="small" color="#FFFFFF" />}
          </View>
        ) : (
          <View style={styles.addBar}>
            <Pressable
              accessibilityRole="button"
              onPress={() => handleAddIngredient()}
              style={styles.addButton}
              disabled={addingLoading}>
              {addingLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
              )}
            </Pressable>
            <TextInput
              onChangeText={setIngredient}
              onSubmitEditing={() => handleAddIngredient()}
              placeholder={`Agregar a ${selectedCategory.name.toLowerCase()}`}
              placeholderTextColor="#9CA3AF"
              returnKeyType="done"
              style={styles.input}
              value={ingredient}
            />
            <Pressable accessibilityRole="button" onPress={() => setActiveView('search')} style={styles.searchButton}>
              <MaterialCommunityIcons name="magnify" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        )}

        {/* Contenido según vista */}

        {/* VISTA: Categorias */}
        {activeView === 'categories' && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Categorias</Text>
              <Text style={styles.sectionMeta}>{items.length} ingredientes total</Text>
            </View>

            <View style={styles.categoryGrid}>
              {CATEGORIES.map((category) => {
                const count = itemsByCategory[category.id]?.length || 0;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={category.id}
                    onPress={() => openCategory(category.id)}
                    style={styles.categoryCard}>
                    <View style={[styles.categoryIcon, { backgroundColor: category.color + '33' }]}>
                      <MaterialCommunityIcons name={category.icon} size={24} color={category.color} />
                    </View>
                    <View style={styles.categoryInfoRow}>
                      <View style={styles.categoryCopy}>
                        <Text style={styles.categoryName}>{category.name}</Text>
                        <Text style={styles.categoryCount}>{count} ingredientes</Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={22} color="#9CA3AF" />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* VISTA: Agregar ingrediente */}
        {activeView === 'add' && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Agregar en</Text>
              <Text style={styles.sectionMeta}>{selectedCategory.name}</Text>
            </View>

            <View style={styles.categoryGrid}>
              {CATEGORIES.map((category) => {
                const isSelected = category.id === selectedCategory.id;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={category.id}
                    onPress={() => setSelectedCategoryId(category.id)}
                    style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}>
                    <View style={[styles.categoryIcon, isSelected && styles.categoryIconSelected]}>
                      <MaterialCommunityIcons name={category.icon} size={24} color="#FFFFFF" />
                    </View>
                    <View style={styles.categoryCopy}>
                      <Text style={styles.categoryName}>{category.name}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* VISTA: Detalle de categoría */}
        {activeView === 'category' && (
          <View style={styles.detailPanel}>
            <View style={styles.detailHeader}>
              <View style={[styles.detailIcon, { backgroundColor: selectedCategory.color + '33' }]}>
                <MaterialCommunityIcons name={selectedCategory.icon} size={26} color={selectedCategory.color} />
              </View>
              <View style={styles.detailCopy}>
                <Text style={styles.detailTitle}>{selectedCategory.name}</Text>
                <Text style={styles.detailSubtitle}>
                  {itemsByCategory[selectedCategory.id]?.length || 0} ingredientes en esta categoria.
                </Text>
              </View>
            </View>

            {/* Lista de ingredientes */}
            <View style={styles.ingredientsList}>
              {(itemsByCategory[selectedCategory.id] || []).length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="food-off" size={40} color="#555" />
                  <Text style={styles.emptyText}>No hay ingredientes en esta categoría</Text>
                  <Pressable
                    style={styles.emptyButton}
                    onPress={() => {
                      setActiveView('add');
                      setSelectedCategoryId(selectedCategory.id);
                    }}>
                    <Text style={styles.emptyButtonText}>Agregar uno</Text>
                  </Pressable>
                </View>
              ) : (
                (itemsByCategory[selectedCategory.id] || []).map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.ingredientCard}
                    onLongPress={() => handleDeleteIngredient(item.id)}>
                    <Image source={{ uri: getPlaceholderUri(item.nombre_producto) }} style={styles.ingredientImage} />
                    <View style={styles.ingredientLabel}>
                      <Text style={styles.ingredientText} numberOfLines={2}>
                        {item.nombre_producto}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.deleteButton}
                      onPress={() => handleDeleteIngredient(item.id)}>
                      <MaterialCommunityIcons name="close-circle" size={18} color="#f87171" />
                    </Pressable>
                  </Pressable>
                ))
              )}
            </View>
          </View>
        )}

        {/* VISTA: Busqueda */}
        {activeView === 'search' && (
          <View style={styles.detailPanel}>
            {searchQuery.trim() === '' ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="magnify" size={40} color="#555" />
                <Text style={styles.emptyText}>Escribe para buscar ingredientes en tu despensa</Text>
              </View>
            ) : searching ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color="#FFFFFF" />
              </View>
            ) : searchResults.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="emoticon-sad-outline" size={40} color="#555" />
                <Text style={styles.emptyText}>No se encontraron ingredientes con "{searchQuery}"</Text>
              </View>
            ) : (
              <>
                <Text style={styles.searchResultsTitle}>
                  {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}
                </Text>
                <View style={styles.ingredientsList}>
                  {searchResults.map((item) => (
                    <Pressable
                      key={item.id}
                      style={styles.ingredientCard}
                      onLongPress={() => handleDeleteIngredient(item.id)}>
                      <Image source={{ uri: getPlaceholderUri(item.nombre_producto) }} style={styles.ingredientImage} />
                      <View style={styles.ingredientLabel}>
                        <Text style={styles.ingredientText} numberOfLines={2}>
                          {item.nombre_producto}
                        </Text>
                        <Text style={styles.ingredientCategory}>{item.categoria}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
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
  deleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    padding: 2,
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 12,
    backgroundColor: 'transparent',
  },
  emptyText: {
    color: '#888',
    fontSize: 15,
    textAlign: 'center',
  },
  emptyButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#2A2A2A',
    marginTop: 4,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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
    position: 'relative',
  },
  ingredientCategory: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: 'transparent',
  },
  loadingText: {
    color: '#B8B8B8',
    fontSize: 16,
    fontWeight: '700',
  },
  searchButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#2A2A2A',
  },
  searchIconStatic: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultsTitle: {
    color: '#B8B8B8',
    fontSize: 14,
    fontWeight: '700',
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
