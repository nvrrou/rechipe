import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useAuth } from '@/contexts/AuthContext';
import { DespensaItemData, fetchDespensa } from '@/services/despensa';
import { BudgetPurchaseSuggestion, GeneratedRecipe, generateBudgetRecipe, generateRecipes } from '@/services/recipes';
import { appendShoppingItems, createShoppingItem } from '@/services/shoppingList';

type MealType = {
  id: string;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
};

type RecipeMode = 'despensa' | 'presupuesto';

type PurchaseSuggestion = {
  id: string;
  nombre: string;
  categoria: string;
  cantidad: string;
  precio: number;
  mealTypes: string[];
  reason: string;
};

const MEAL_TYPES: MealType[] = [
  { id: 'Desayuno', label: 'Desayuno', icon: 'coffee-outline', color: '#00B86B' },
  { id: 'Almuerzo', label: 'Almuerzo', icon: 'silverware-fork-knife', color: '#009E5A' },
  { id: 'Cena', label: 'Cena', icon: 'food-turkey', color: '#36B779' },
  { id: 'Snack', label: 'Snack', icon: 'food-apple-outline', color: '#45B883' },
  { id: 'Postre', label: 'Postre', icon: 'cupcake', color: '#69DFA5' },
  { id: 'Meal prep', label: 'Meal prep', icon: 'calendar-clock', color: '#4ECFA1' },
];

const QUICK_OBJECTIVES = ['Alto en proteínas', 'Bajo en calorías', 'Barato', 'Rápido', 'Sin azúcar', 'Equilibrado'];

function itemSubtitle(item: DespensaItemData) {
  return [item.categoria, item.cantidad ? `${item.cantidad} ${item.unidad || ''}`.trim() : undefined]
    .filter(Boolean)
    .join(' · ');
}

function formatPrice(value: number) {
  return `CLP ${Math.round(value).toLocaleString('es-CL')}`;
}

function parseBudget(value: string) {
  const parsed = Number(value.replace(/[^\d]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function RecipeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<DespensaItemData[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [recipeMode, setRecipeMode] = useState<RecipeMode>('despensa');
  const [selectedMeal, setSelectedMeal] = useState(MEAL_TYPES[0].id);
  const [mealDropdownOpen, setMealDropdownOpen] = useState(false);
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<string[]>([]);
  const [budgetInput, setBudgetInput] = useState('');
  const [purchaseSuggestions, setPurchaseSuggestions] = useState<PurchaseSuggestion[]>([]);
  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [objective, setObjective] = useState('');
  const [generating, setGenerating] = useState(false);
  const [recipes, setRecipes] = useState<GeneratedRecipe[]>([]);
  const [error, setError] = useState('');

  const loadDespensa = useCallback(async () => {
    if (!user?.id) return;
    setLoadingItems(true);
    const result = await fetchDespensa(user.id);
    if (result.items) {
      setItems(result.items);
    } else if (result.error) {
      setError(result.error);
    }
    setLoadingItems(false);
  }, [user?.id]);

  useEffect(() => {
    loadDespensa();
  }, [loadDespensa]);

  useFocusEffect(
    useCallback(() => {
      loadDespensa();
    }, [loadDespensa])
  );

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      [item.nombre_producto, item.categoria, item.marca].filter(Boolean).join(' ').toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  const selectedIngredients = useMemo(
    () => items.filter((item) => selectedIngredientIds.includes(item.id)),
    [items, selectedIngredientIds]
  );

  const selectedMealType = useMemo(
    () => MEAL_TYPES.find((meal) => meal.id === selectedMeal) ?? MEAL_TYPES[0],
    [selectedMeal]
  );

  const selectedPurchaseSuggestions = useMemo(
    () => purchaseSuggestions.filter((item) => selectedPurchaseIds.includes(item.id)),
    [purchaseSuggestions, selectedPurchaseIds]
  );

  const selectedPurchaseTotal = useMemo(
    () => selectedPurchaseSuggestions.reduce((sum, item) => sum + item.precio, 0),
    [selectedPurchaseSuggestions]
  );

  function toggleIngredient(itemId: string) {
    setError('');
    setSelectedIngredientIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  }

  function toggleObjective(value: string) {
    setObjective((prev) => (prev === value ? '' : value));
  }

  async function handleGenerate() {
    if (!user?.id) {
      setError('No hay usuario activo para generar recetas.');
      return;
    }

    setGenerating(true);
    setError('');
    setRecipes([]);

    const result = await generateRecipes({
      user_id: user.id,
      tipo_comida: selectedMeal,
      ingredientes: selectedIngredients.map((item) => item.nombre_producto),
      objetivo_nutricional: objective.trim(),
    });

    if (result.error) {
      setError(result.error);
    } else if (result.recetas?.length) {
      setRecipes(result.recetas.slice(0, 3));
    } else {
      setError('No llegaron recetas desde el backend.');
    }

    setGenerating(false);
  }

  function clearSelection() {
    setSelectedIngredientIds([]);
    setRecipes([]);
    setError('');
  }

  async function buildPurchaseSuggestions() {
    const budget = parseBudget(budgetInput);
    if (budget <= 0) {
      setError('Ingresa un presupuesto para recomendar compras.');
      return;
    }

    if (!user?.id) {
      setError('No hay usuario activo para generar receta presupuestada.');
      return;
    }

    setGenerating(true);
    setError('');
    setRecipes([]);
    setPurchaseSuggestions([]);
    setSelectedPurchaseIds([]);

    const result = await generateBudgetRecipe({
      user_id: user.id,
      tipo_comida: selectedMeal,
      presupuesto: budget,
      objetivo_nutricional: objective.trim(),
    });

    if (result.error) {
      setError(result.error);
    } else {
      const suggestions = (result.compras_sugeridas || []).map((item: BudgetPurchaseSuggestion, index) => ({
        id: `${item.nombre}-${index}`,
        nombre: item.nombre,
        categoria: item.categoria,
        cantidad: item.cantidad,
        precio: item.precio,
        mealTypes: [selectedMeal],
        reason: item.reason || 'Complementa tu despensa para esta receta.',
      }));
      setPurchaseSuggestions(suggestions);
      setSelectedPurchaseIds(suggestions.map((item) => item.id));
      setRecipes(result.recetas?.slice(0, 1) || []);

      if (!result.recetas?.length) {
        setError('No llegó receta desde el backend.');
      }
    }

    setGenerating(false);
  }

  function togglePurchaseSuggestion(itemId: string) {
    setSelectedPurchaseIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  }

  async function addSuggestionsToShoppingList() {
    if (selectedPurchaseSuggestions.length === 0) {
      setError('Selecciona al menos una compra sugerida.');
      return;
    }

    await appendShoppingItems(
      selectedPurchaseSuggestions.map((item) =>
        createShoppingItem({
          nombre: item.nombre,
          categoria: item.categoria,
          cantidad: item.cantidad,
          precio: item.precio,
        })
      )
    );
    setError('');
    router.push('/(navbarnt)/lista');
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.title}>Generar receta</Text>
          <Text style={styles.subtitle}>Elige el tipo de comida y, si quieres, ingredientes que deben aparecer sí o sí.</Text>
        </View>

        <View style={styles.modeSwitch}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setRecipeMode('despensa')}
            style={[styles.modeButton, recipeMode === 'despensa' && styles.modeButtonActive]}>
            <MaterialCommunityIcons
              name="fridge-outline"
              size={18}
              color={recipeMode === 'despensa' ? '#FBFFF8' : '#2F7A4F'}
            />
            <Text style={[styles.modeButtonText, recipeMode === 'despensa' && styles.modeButtonTextActive]}>
              Desde la despensa
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setRecipeMode('presupuesto')}
            style={[styles.modeButton, recipeMode === 'presupuesto' && styles.modeButtonActive]}>
            <MaterialCommunityIcons
              name="cash-multiple"
              size={18}
              color={recipeMode === 'presupuesto' ? '#FBFFF8' : '#2F7A4F'}
            />
            <Text style={[styles.modeButtonText, recipeMode === 'presupuesto' && styles.modeButtonTextActive]}>
              Presupuestada
            </Text>
          </Pressable>
        </View>

        {recipeMode === 'despensa' ? (
          <>
            <View style={styles.detailPanel}>
              <View style={styles.panelHeader}>
                <View style={styles.panelIcon}>
                  <MaterialCommunityIcons name="silverware" size={22} color="#064E2F" />
                </View>
                <View style={styles.panelCopy}>
                  <Text style={styles.panelTitle}>Tipo de comida</Text>
                  <Text style={styles.panelSubtitle}>{selectedMeal}</Text>
                </View>
              </View>

              <View style={styles.dropdownWrap}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setMealDropdownOpen((prev) => !prev)}
                  style={styles.mealDropdownButton}>
                  <View style={styles.mealDropdownLeft}>
                    <View style={[styles.mealIcon, { backgroundColor: selectedMealType.color + '33' }]}>
                      <MaterialCommunityIcons name={selectedMealType.icon} size={22} color={selectedMealType.color} />
                    </View>
                    <Text style={styles.mealDropdownText}>{selectedMealType.label}</Text>
                  </View>
                  <MaterialCommunityIcons name={mealDropdownOpen ? 'chevron-up' : 'chevron-down'} size={22} color="#064E2F" />
                </Pressable>

                {mealDropdownOpen && (
                  <View style={styles.mealDropdownMenu}>
                    {MEAL_TYPES.map((meal) => {
                      const isSelected = selectedMeal === meal.id;
                      return (
                        <Pressable
                          accessibilityRole="button"
                          key={meal.id}
                          onPress={() => {
                            setSelectedMeal(meal.id);
                            setMealDropdownOpen(false);
                          }}
                          style={[styles.mealDropdownOption, isSelected && styles.mealDropdownOptionSelected]}>
                          <View style={[styles.mealOptionIcon, { backgroundColor: meal.color + '33' }]}>
                            <MaterialCommunityIcons name={meal.icon} size={19} color={meal.color} />
                          </View>
                          <Text style={styles.mealDropdownOptionText}>{meal.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>

            <View style={styles.detailPanel}>
              <View style={styles.panelHeader}>
                <View style={styles.panelIcon}>
                  <MaterialCommunityIcons name="target" size={22} color="#064E2F" />
                </View>
                <View style={styles.panelCopy}>
                  <Text style={styles.panelTitle}>Objetivo</Text>
                  <Text style={styles.panelSubtitle}>Opcional para guiar la receta.</Text>
                </View>
              </View>

              <View style={styles.objectiveRow}>
                {QUICK_OBJECTIVES.map((item) => (
                  <Pressable
                    accessibilityRole="button"
                    key={item}
                    onPress={() => toggleObjective(item)}
                    style={[styles.objectiveChip, objective === item && styles.objectiveChipSelected]}>
                    <Text style={[styles.objectiveChipText, objective === item && styles.objectiveChipTextSelected]}>{item}</Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                onChangeText={setObjective}
                placeholder="O escribe algo más específico..."
                placeholderTextColor="#43A66C"
                style={styles.textInput}
                value={objective}
              />
            </View>

            <View style={styles.detailPanel}>
              <View style={styles.panelHeader}>
                <View style={styles.panelIcon}>
                  <MaterialCommunityIcons name="fridge-outline" size={22} color="#064E2F" />
                </View>
                <View style={styles.panelCopy}>
                  <Text style={styles.panelTitle}>Ingredientes opcionales</Text>
                  <Text style={styles.panelSubtitle}>
                    {selectedIngredients.length > 0
                      ? `${selectedIngredients.length} obligatorio${selectedIngredients.length === 1 ? '' : 's'}`
                      : 'La IA puede usar toda tu despensa'}
                  </Text>
                </View>
                {selectedIngredients.length > 0 && (
                  <Pressable accessibilityRole="button" onPress={clearSelection} style={styles.clearButton}>
                    <MaterialCommunityIcons name="close" size={20} color="#064E2F" />
                  </Pressable>
                )}
              </View>

              <View style={styles.searchBar}>
                <MaterialCommunityIcons name="magnify" size={22} color="#2F7A4F" />
                <TextInput
                  onChangeText={setSearchQuery}
                  onFocus={loadDespensa}
                  placeholder="Buscar ingredientes de tu refri..."
                  placeholderTextColor="#2F7A4F"
                  style={styles.searchInput}
                  value={searchQuery}
                />
              </View>

              {loadingItems ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator size="large" color="#064E2F" />
                </View>
              ) : filteredItems.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="food-off" size={40} color="#4F9F70" />
                  <Text style={styles.emptyText}>No hay ingredientes para seleccionar</Text>
                </View>
              ) : (
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                  style={styles.ingredientScroller}
                  contentContainerStyle={styles.ingredientList}>
                  {filteredItems.map((item) => {
                    const isSelected = selectedIngredientIds.includes(item.id);
                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={item.id}
                        onPress={() => toggleIngredient(item.id)}
                        style={[styles.ingredientRow, isSelected && styles.ingredientRowSelected]}>
                        <View style={[styles.checkBox, isSelected && styles.checkBoxSelected]}>
                          {isSelected && <MaterialCommunityIcons name="check" size={17} color="#FBFFF8" />}
                        </View>
                        <View style={styles.ingredientCopy}>
                          <Text style={styles.ingredientTitle}>{item.nombre_producto}</Text>
                          <Text style={styles.ingredientSubtitle}>{itemSubtitle(item) || 'Sin detalle'}</Text>
                        </View>
                        <Text style={styles.macroPill}>{item.energia_kcal ?? 0} kcal</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </>
        ) : (
          <View style={styles.detailPanel}>
            <View style={styles.panelHeader}>
              <View style={styles.panelIcon}>
                <MaterialCommunityIcons name="cash-multiple" size={22} color="#064E2F" />
              </View>
              <View style={styles.panelCopy}>
                <Text style={styles.panelTitle}>Receta presupuestada</Text>
                <Text style={styles.panelSubtitle}>Compra lo que falta según tu despensa y presupuesto.</Text>
              </View>
            </View>

            <View style={styles.budgetInputRow}>
              <View style={styles.budgetInputBox}>
                <Text style={styles.budgetLabel}>Presupuesto</Text>
                <TextInput
                  keyboardType="numeric"
                  onChangeText={setBudgetInput}
                  placeholder="Ej: 12000"
                  placeholderTextColor="#43A66C"
                  style={styles.budgetInput}
                  value={budgetInput}
                />
              </View>
              <Pressable accessibilityRole="button" disabled={generating} onPress={buildPurchaseSuggestions} style={styles.budgetGenerateButton}>
                {generating ? (
                  <ActivityIndicator size="small" color="#FBFFF8" />
                ) : (
                  <MaterialCommunityIcons name="creation" size={20} color="#FBFFF8" />
                )}
              </Pressable>
            </View>

            <View style={styles.budgetContext}>
              <Text style={styles.budgetContextText}>{items.length} ingredientes disponibles en despensa</Text>
              <Text style={styles.budgetContextText}>{selectedMeal}</Text>
            </View>

            {purchaseSuggestions.length === 0 ? (
              <View style={styles.budgetBox}>
                <MaterialCommunityIcons name="cart-plus" size={38} color="#00B86B" />
                <Text style={styles.budgetTitle}>Genera receta y compras</Text>
                <Text style={styles.budgetText}>
                  Usaré tu despensa y sugeriré compras dentro del presupuesto. Si no hay precio en la base, lo estimo para Chile.
                </Text>
              </View>
            ) : (
              <View style={styles.purchaseList}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Compras sugeridas</Text>
                  <Text style={styles.sectionMeta}>{formatPrice(selectedPurchaseTotal)}</Text>
                </View>

                {purchaseSuggestions.map((item) => {
                  const isSelected = selectedPurchaseIds.includes(item.id);
                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={item.id}
                      onPress={() => togglePurchaseSuggestion(item.id)}
                      style={[styles.purchaseRow, isSelected && styles.purchaseRowSelected]}>
                      <View style={[styles.checkBox, isSelected && styles.checkBoxSelected]}>
                        {isSelected && <MaterialCommunityIcons name="check" size={17} color="#FBFFF8" />}
                      </View>
                      <View style={styles.ingredientCopy}>
                        <Text style={styles.ingredientTitle}>{item.nombre}</Text>
                        <Text style={styles.ingredientSubtitle}>{item.cantidad} · {item.reason}</Text>
                      </View>
                      <Text style={styles.pricePill}>{formatPrice(item.precio)}</Text>
                    </Pressable>
                  );
                })}

                <Pressable accessibilityRole="button" onPress={addSuggestionsToShoppingList} style={styles.budgetLink}>
                  <MaterialCommunityIcons name="cart-arrow-right" size={20} color="#FBFFF8" />
                  <Text style={styles.budgetLinkText}>Mandar a lista de compras</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => router.push('/(navbarnt)/lista')} style={styles.listGhostLink}>
                  <Text style={styles.listGhostLinkText}>Ver lista actual</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {error !== '' && (
          <View style={styles.errorPanel}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#FF8A8A" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {recipeMode === 'despensa' && (
          <Pressable accessibilityRole="button" disabled={generating} onPress={handleGenerate} style={styles.generateButton}>
            {generating ? (
              <ActivityIndicator size="small" color="#FBFFF8" />
            ) : (
              <>
                <MaterialCommunityIcons name="creation" size={22} color="#FBFFF8" />
                <Text style={styles.generateButtonText}>Generar recetas</Text>
              </>
            )}
          </Pressable>
        )}

        {recipes.length > 0 && (
          <View style={styles.resultsWrap}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Resultados</Text>
              <Text style={styles.sectionMeta}>{recipes.length} receta{recipes.length === 1 ? '' : 's'}</Text>
            </View>

            {recipes.map((recipe, index) => (
              <View key={`${recipe.titulo}-${index}`} style={styles.recipeCard}>
                <View style={styles.recipeHeader}>
                  <View style={styles.recipeNumber}>
                    <Text style={styles.recipeNumberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.recipeHeaderCopy}>
                    <Text style={styles.recipeTitle}>{recipe.titulo}</Text>
                    <Text style={styles.recipeMeta}>
                      {[recipe.tiempo_preparacion, recipe.dificultad].filter(Boolean).join(' · ') || selectedMeal}
                    </Text>
                  </View>
                </View>

                {!!recipe.por_que_funciona && (
                  <View style={styles.whyBox}>
                    <Text style={styles.whyText}>{recipe.por_que_funciona}</Text>
                  </View>
                )}

                {!!recipe.macros_totales && (
                  <View style={styles.macroRow}>
                    <Text style={styles.macroPill}>{recipe.macros_totales.calorias ?? 0} kcal</Text>
                    <Text style={styles.macroPill}>P {recipe.macros_totales.proteinas ?? 0}g</Text>
                    <Text style={styles.macroPill}>C {recipe.macros_totales.carbohidratos ?? 0}g</Text>
                    <Text style={styles.macroPill}>G {recipe.macros_totales.grasas ?? 0}g</Text>
                  </View>
                )}

                {!!recipe.ingredientes?.length && (
                  <View style={styles.recipeSection}>
                    <Text style={styles.recipeSectionTitle}>Ingredientes</Text>
                    {recipe.ingredientes.map((ingredient, ingredientIndex) => (
                      <Text key={`${ingredient}-${ingredientIndex}`} style={styles.recipeLine}>
                        {ingredient}
                      </Text>
                    ))}
                  </View>
                )}

                {!!recipe.pasos?.length && (
                  <View style={styles.recipeSection}>
                    <Text style={styles.recipeSectionTitle}>Pasos</Text>
                    {recipe.pasos.map((step, stepIndex) => (
                      <Text key={`${step}-${stepIndex}`} style={styles.recipeLine}>
                        {step}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  budgetBox: {
    alignItems: 'center',
    gap: 12,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#74D997',
    backgroundColor: '#D8FBE3',
  },
  budgetContext: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'transparent',
  },
  budgetContextText: {
    color: '#2F7A4F',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#9FE7B9',
    overflow: 'hidden',
  },
  budgetGenerateButton: {
    width: 56,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#00B86B',
    shadowColor: '#00B86B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 3,
  },
  budgetInput: {
    color: '#064E2F',
    fontSize: 24,
    fontWeight: '900',
    padding: 0,
  },
  budgetInputBox: {
    flex: 1,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  budgetInputRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    backgroundColor: 'transparent',
  },
  budgetLabel: {
    color: '#2F7A4F',
    fontSize: 12,
    fontWeight: '800',
  },
  budgetLink: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#00B86B',
    shadowColor: '#00B86B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 3,
  },
  budgetLinkText: {
    color: '#FBFFF8',
    fontSize: 15,
    fontWeight: '900',
  },
  budgetText: {
    color: '#007A45',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },
  budgetTitle: {
    color: '#064E2F',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  checkBox: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    backgroundColor: '#DDF8E7',
  },
  checkBoxSelected: {
    borderColor: '#00B86B',
    backgroundColor: '#00B86B',
  },
  clearButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#9FE7B9',
  },
  container: {
    flex: 1,
    backgroundColor: '#FBFFF8',
  },
  content: {
    gap: 18,
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 130,
  },
  detailPanel: {
    gap: 16,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
    shadowColor: '#74D997',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 2,
  },
  dropdownWrap: {
    gap: 8,
    backgroundColor: 'transparent',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 12,
    backgroundColor: 'transparent',
  },
  emptyText: {
    color: '#2F7A4F',
    fontSize: 15,
    textAlign: 'center',
  },
  errorPanel: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#8D2B3D',
    backgroundColor: '#351928',
  },
  errorText: {
    flex: 1,
    color: '#FF8A8A',
    fontSize: 13,
    fontWeight: '800',
  },
  generateButton: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 18,
    backgroundColor: '#00B86B',
    shadowColor: '#00B86B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 3,
  },
  generateButtonText: {
    color: '#FBFFF8',
    fontSize: 16,
    fontWeight: '900',
  },
  hero: {
    gap: 14,
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  ingredientCopy: {
    flex: 1,
    gap: 3,
    backgroundColor: 'transparent',
  },
  ingredientList: {
    gap: 10,
    backgroundColor: 'transparent',
  },
  ingredientRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  ingredientRowSelected: {
    borderColor: '#00B86B',
    backgroundColor: '#DFF2E6',
  },
  ingredientScroller: {
    maxHeight: 224,
  },
  ingredientSubtitle: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '700',
  },
  ingredientTitle: {
    color: '#064E2F',
    fontSize: 15,
    fontWeight: '900',
  },
  macroPill: {
    color: '#064E2F',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#9FE7B9',
    overflow: 'hidden',
  },
  macroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: 'transparent',
  },
  mealDropdownButton: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  mealDropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  mealDropdownMenu: {
    gap: 8,
    padding: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  mealDropdownOption: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: 'transparent',
  },
  mealDropdownOptionSelected: {
    backgroundColor: '#9FE7B9',
  },
  mealDropdownOptionText: {
    color: '#064E2F',
    fontSize: 14,
    fontWeight: '800',
  },
  mealDropdownText: {
    color: '#064E2F',
    fontSize: 15,
    fontWeight: '900',
  },
  mealIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  mealOptionIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  listGhostLink: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  listGhostLinkText: {
    color: '#064E2F',
    fontSize: 14,
    fontWeight: '900',
  },
  modeButton: {
    minHeight: 48,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  modeButtonActive: {
    backgroundColor: '#00B86B',
  },
  modeButtonText: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '900',
  },
  modeButtonTextActive: {
    color: '#FBFFF8',
  },
  modeSwitch: {
    flexDirection: 'row',
    gap: 8,
    padding: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  objectiveChip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  objectiveChipSelected: {
    borderColor: '#00B86B',
    backgroundColor: '#9FE7B9',
  },
  objectiveChipText: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '800',
  },
  objectiveChipTextSelected: {
    color: '#064E2F',
  },
  objectiveRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'transparent',
  },
  panelCopy: {
    flex: 1,
    gap: 3,
    backgroundColor: 'transparent',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  panelIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#9FE7B9',
  },
  panelSubtitle: {
    color: '#2F7A4F',
    fontSize: 14,
    fontWeight: '600',
  },
  panelTitle: {
    color: '#064E2F',
    fontSize: 18,
    fontWeight: '900',
  },
  pricePill: {
    color: '#00B86B',
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#74D997',
    backgroundColor: '#D8FBE3',
    overflow: 'hidden',
  },
  purchaseList: {
    gap: 10,
    backgroundColor: 'transparent',
  },
  purchaseRow: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  purchaseRowSelected: {
    borderColor: '#74D997',
    backgroundColor: '#D8FBE3',
  },
  recipeCard: {
    gap: 14,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  recipeHeader: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'transparent',
  },
  recipeHeaderCopy: {
    flex: 1,
    gap: 4,
    backgroundColor: 'transparent',
  },
  recipeLine: {
    color: '#0B6B40',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  recipeMeta: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '700',
  },
  recipeNumber: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#9FE7B9',
  },
  recipeNumberText: {
    color: '#064E2F',
    fontSize: 15,
    fontWeight: '900',
  },
  recipeSection: {
    gap: 6,
    backgroundColor: 'transparent',
  },
  recipeSectionTitle: {
    color: '#064E2F',
    fontSize: 15,
    fontWeight: '900',
  },
  recipeTitle: {
    color: '#064E2F',
    fontSize: 19,
    fontWeight: '900',
  },
  resultsWrap: {
    gap: 12,
    backgroundColor: 'transparent',
  },
  searchBar: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: '#064E2F',
    fontSize: 15,
    fontWeight: '800',
    paddingVertical: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  sectionMeta: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '800',
  },
  sectionTitle: {
    color: '#064E2F',
    fontSize: 18,
    fontWeight: '900',
  },
  subtitle: {
    color: '#2F7A4F',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  textInput: {
    minHeight: 54,
    color: '#064E2F',
    fontSize: 15,
    fontWeight: '800',
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  title: {
    color: '#064E2F',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },
  whyBox: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#D8FBE3',
    borderWidth: 1,
    borderColor: '#74D997',
  },
  whyText: {
    color: '#007A45',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
});
