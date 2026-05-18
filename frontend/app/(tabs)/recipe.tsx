import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useAuth } from '@/contexts/AuthContext';
import { DespensaItemData, fetchDespensa } from '@/services/despensa';
import { GeneratedRecipe, generateRecipes } from '@/services/recipes';
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
  { id: 'Desayuno', label: 'Desayuno', icon: 'coffee-outline', color: '#F97316' },
  { id: 'Almuerzo', label: 'Almuerzo', icon: 'silverware-fork-knife', color: '#16A34A' },
  { id: 'Cena', label: 'Cena', icon: 'food-turkey', color: '#2563EB' },
  { id: 'Snack', label: 'Snack', icon: 'food-apple-outline', color: '#DC2626' },
  { id: 'Postre', label: 'Postre', icon: 'cupcake', color: '#C026D3' },
  { id: 'Meal prep', label: 'Meal prep', icon: 'calendar-clock', color: '#0891B2' },
];

const QUICK_OBJECTIVES = ['Alto en proteínas', 'Bajo en calorías', 'Barato', 'Rápido', 'Sin azúcar', 'Equilibrado'];

const PURCHASE_CATALOG: PurchaseSuggestion[] = [
  {
    id: 'pollo-filete',
    nombre: 'Pechuga de pollo',
    categoria: 'Carnes',
    cantidad: '500 g',
    precio: 4200,
    mealTypes: ['Almuerzo', 'Cena', 'Meal prep'],
    reason: 'Suma proteína y combina con casi cualquier base de la despensa.',
  },
  {
    id: 'huevos',
    nombre: 'Huevos',
    categoria: 'Proteínas',
    cantidad: '12 unidades',
    precio: 3600,
    mealTypes: ['Desayuno', 'Cena', 'Snack'],
    reason: 'Baratos, rápidos y útiles para completar comidas simples.',
  },
  {
    id: 'yogurt-natural',
    nombre: 'Yogurt natural',
    categoria: 'Lácteos',
    cantidad: '1 kg',
    precio: 2990,
    mealTypes: ['Desayuno', 'Snack', 'Postre'],
    reason: 'Sirve para desayunos, salsas y snacks con fruta o avena.',
  },
  {
    id: 'avena',
    nombre: 'Avena',
    categoria: 'Cereales',
    cantidad: '1 kg',
    precio: 1990,
    mealTypes: ['Desayuno', 'Snack', 'Postre'],
    reason: 'Rinde mucho y sube saciedad con poco presupuesto.',
  },
  {
    id: 'verduras-surtidas',
    nombre: 'Verduras surtidas',
    categoria: 'Verduras',
    cantidad: '1 bolsa',
    precio: 2500,
    mealTypes: ['Almuerzo', 'Cena', 'Meal prep'],
    reason: 'Completa platos con volumen, fibra y color.',
  },
  {
    id: 'atun',
    nombre: 'Atún',
    categoria: 'Proteínas',
    cantidad: '2 latas',
    precio: 3200,
    mealTypes: ['Almuerzo', 'Cena', 'Snack'],
    reason: 'Proteína lista para usar cuando falta tiempo.',
  },
  {
    id: 'legumbres',
    nombre: 'Lentejas',
    categoria: 'Legumbres',
    cantidad: '1 kg',
    precio: 2400,
    mealTypes: ['Almuerzo', 'Cena', 'Meal prep'],
    reason: 'Base barata para porciones grandes y nutritivas.',
  },
  {
    id: 'platano',
    nombre: 'Plátano',
    categoria: 'Frutas',
    cantidad: '1 kg',
    precio: 1800,
    mealTypes: ['Desayuno', 'Snack', 'Postre'],
    reason: 'Aporta energía rápida y combina bien con avena o yogurt.',
  },
  {
    id: 'palta',
    nombre: 'Palta',
    categoria: 'Verduras',
    cantidad: '2 unidades',
    precio: 2600,
    mealTypes: ['Desayuno', 'Almuerzo', 'Cena'],
    reason: 'Mejora textura y grasas saludables en platos simples.',
  },
  {
    id: 'quesillo',
    nombre: 'Quesillo',
    categoria: 'Lácteos',
    cantidad: '300 g',
    precio: 2800,
    mealTypes: ['Desayuno', 'Snack', 'Cena'],
    reason: 'Proteína ligera para acompañar pan, ensaladas o bowls.',
  },
];

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

  function buildPurchaseSuggestions() {
    const budget = parseBudget(budgetInput);
    if (budget <= 0) {
      setError('Ingresa un presupuesto para recomendar compras.');
      return;
    }

    const pantryNames = new Set(items.map((item) => item.nombre_producto?.toLowerCase()).filter(Boolean));
    const pantryCategories = new Set(items.map((item) => item.categoria?.toLowerCase()).filter(Boolean));

    const scoredSuggestions = PURCHASE_CATALOG.filter((item) => !pantryNames.has(item.nombre.toLowerCase()))
      .map((item) => {
        let score = item.mealTypes.includes(selectedMeal) ? 4 : 0;
        if (!pantryCategories.has(item.categoria.toLowerCase())) score += 2;
        if (objective === 'Barato' && item.precio <= 2800) score += 2;
        if (objective === 'Alto en proteínas' && ['Carnes', 'Proteínas', 'Lácteos'].includes(item.categoria)) score += 2;
        if (objective === 'Rápido' && ['Huevos', 'Atún', 'Yogurt natural'].includes(item.nombre)) score += 2;
        return { item, score };
      })
      .sort((a, b) => b.score - a.score || a.item.precio - b.item.precio)
      .map(({ item }) => item);

    const nextSuggestions: PurchaseSuggestion[] = [];
    let remainingBudget = budget;

    scoredSuggestions.forEach((item) => {
      if (nextSuggestions.length >= 6) return;
      if (item.precio <= remainingBudget) {
        nextSuggestions.push(item);
        remainingBudget -= item.precio;
      }
    });

    if (nextSuggestions.length === 0) {
      setPurchaseSuggestions([]);
      setSelectedPurchaseIds([]);
      setError('No encontré compras que calcen con ese presupuesto.');
      return;
    }

    setPurchaseSuggestions(nextSuggestions);
    setSelectedPurchaseIds(nextSuggestions.map((item) => item.id));
    setError('');
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
    router.push('/(tabs)/lista');
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.titleRow}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="chef-hat" size={28} color="#FFFFFF" />
            </View>
            <View style={styles.titleCopy}>
              <Text style={styles.title}>Generar receta</Text>
              <Text style={styles.subtitle}>Elige el tipo de comida y, si quieres, ingredientes que deben aparecer sí o sí.</Text>
            </View>
          </View>
        </View>

        <View style={styles.modeSwitch}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setRecipeMode('despensa')}
            style={[styles.modeButton, recipeMode === 'despensa' && styles.modeButtonActive]}>
            <MaterialCommunityIcons
              name="fridge-outline"
              size={18}
              color={recipeMode === 'despensa' ? '#0B0B0B' : '#B8B8B8'}
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
              color={recipeMode === 'presupuesto' ? '#0B0B0B' : '#B8B8B8'}
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
                  <MaterialCommunityIcons name="silverware" size={22} color="#FFFFFF" />
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
                  <MaterialCommunityIcons name={mealDropdownOpen ? 'chevron-up' : 'chevron-down'} size={22} color="#FFFFFF" />
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
                  <MaterialCommunityIcons name="target" size={22} color="#FFFFFF" />
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
                placeholderTextColor="#6B7280"
                style={styles.textInput}
                value={objective}
              />
            </View>

            <View style={styles.detailPanel}>
              <View style={styles.panelHeader}>
                <View style={styles.panelIcon}>
                  <MaterialCommunityIcons name="fridge-outline" size={22} color="#FFFFFF" />
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
                    <MaterialCommunityIcons name="close" size={20} color="#FFFFFF" />
                  </Pressable>
                )}
              </View>

              <View style={styles.searchBar}>
                <MaterialCommunityIcons name="magnify" size={22} color="#9CA3AF" />
                <TextInput
                  onChangeText={setSearchQuery}
                  onFocus={loadDespensa}
                  placeholder="Buscar ingredientes de tu refri..."
                  placeholderTextColor="#9CA3AF"
                  style={styles.searchInput}
                  value={searchQuery}
                />
              </View>

              {loadingItems ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                </View>
              ) : filteredItems.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="food-off" size={40} color="#555" />
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
                          {isSelected && <MaterialCommunityIcons name="check" size={17} color="#0B0B0B" />}
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
                <MaterialCommunityIcons name="cash-multiple" size={22} color="#FFFFFF" />
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
                  placeholderTextColor="#6B7280"
                  style={styles.budgetInput}
                  value={budgetInput}
                />
              </View>
              <Pressable accessibilityRole="button" onPress={buildPurchaseSuggestions} style={styles.budgetGenerateButton}>
                <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color="#0B0B0B" />
              </Pressable>
            </View>

            <View style={styles.budgetContext}>
              <Text style={styles.budgetContextText}>{items.length} ingredientes disponibles en despensa</Text>
              <Text style={styles.budgetContextText}>{selectedMeal}</Text>
            </View>

            {purchaseSuggestions.length === 0 ? (
              <View style={styles.budgetBox}>
                <MaterialCommunityIcons name="cart-plus" size={38} color="#4ADE80" />
                <Text style={styles.budgetTitle}>Genera opciones de compra</Text>
                <Text style={styles.budgetText}>
                  Te sugeriré productos que complementan lo que ya tienes, respetando el presupuesto ingresado.
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
                        {isSelected && <MaterialCommunityIcons name="check" size={17} color="#0B0B0B" />}
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
                  <MaterialCommunityIcons name="cart-arrow-right" size={20} color="#0B0B0B" />
                  <Text style={styles.budgetLinkText}>Mandar a lista de compras</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/lista')} style={styles.listGhostLink}>
                  <Text style={styles.listGhostLinkText}>Ver lista actual</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {error !== '' && (
          <View style={styles.errorPanel}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#f87171" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {recipeMode === 'despensa' && (
          <Pressable accessibilityRole="button" disabled={generating} onPress={handleGenerate} style={styles.generateButton}>
            {generating ? (
              <ActivityIndicator size="small" color="#0B0B0B" />
            ) : (
              <>
                <MaterialCommunityIcons name="creation" size={22} color="#0B0B0B" />
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
    borderColor: '#235D38',
    backgroundColor: '#102017',
  },
  budgetContext: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'transparent',
  },
  budgetContextText: {
    color: '#B8B8B8',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#2A2A2A',
    overflow: 'hidden',
  },
  budgetGenerateButton: {
    width: 56,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  budgetInput: {
    color: '#FFFFFF',
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
    borderColor: '#2A2A2A',
    backgroundColor: '#101010',
  },
  budgetInputRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    backgroundColor: 'transparent',
  },
  budgetLabel: {
    color: '#B8B8B8',
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
    backgroundColor: '#FFFFFF',
  },
  budgetLinkText: {
    color: '#0B0B0B',
    fontSize: 15,
    fontWeight: '900',
  },
  budgetText: {
    color: '#BBF7D0',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },
  budgetTitle: {
    color: '#FFFFFF',
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
    backgroundColor: '#101010',
  },
  checkBoxSelected: {
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
  },
  clearButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#2A2A2A',
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
    color: '#888',
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
    borderColor: '#7F1D1D',
    backgroundColor: '#241313',
  },
  errorText: {
    flex: 1,
    color: '#f87171',
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
    backgroundColor: '#FFFFFF',
  },
  generateButtonText: {
    color: '#0B0B0B',
    fontSize: 16,
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
  heroIcon: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#2A2A2A',
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
    borderColor: '#2A2A2A',
    backgroundColor: '#101010',
  },
  ingredientRowSelected: {
    borderColor: '#FFFFFF',
    backgroundColor: '#232323',
  },
  ingredientScroller: {
    maxHeight: 224,
  },
  ingredientSubtitle: {
    color: '#B8B8B8',
    fontSize: 13,
    fontWeight: '700',
  },
  ingredientTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  macroPill: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#2A2A2A',
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
    borderColor: '#2A2A2A',
    backgroundColor: '#101010',
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
    borderColor: '#2A2A2A',
    backgroundColor: '#101010',
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
    backgroundColor: '#2A2A2A',
  },
  mealDropdownOptionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  mealDropdownText: {
    color: '#FFFFFF',
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
    borderColor: '#2A2A2A',
    backgroundColor: '#101010',
  },
  listGhostLinkText: {
    color: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
  },
  modeButtonText: {
    color: '#B8B8B8',
    fontSize: 13,
    fontWeight: '900',
  },
  modeButtonTextActive: {
    color: '#0B0B0B',
  },
  modeSwitch: {
    flexDirection: 'row',
    gap: 8,
    padding: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#171717',
  },
  objectiveChip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#101010',
  },
  objectiveChipSelected: {
    borderColor: '#FFFFFF',
    backgroundColor: '#2A2A2A',
  },
  objectiveChipText: {
    color: '#B8B8B8',
    fontSize: 13,
    fontWeight: '800',
  },
  objectiveChipTextSelected: {
    color: '#FFFFFF',
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
    backgroundColor: '#2A2A2A',
  },
  panelSubtitle: {
    color: '#B8B8B8',
    fontSize: 14,
    fontWeight: '600',
  },
  panelTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  pricePill: {
    color: '#4ADE80',
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#235D38',
    backgroundColor: '#163321',
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
    borderColor: '#2A2A2A',
    backgroundColor: '#101010',
  },
  purchaseRowSelected: {
    borderColor: '#235D38',
    backgroundColor: '#102017',
  },
  recipeCard: {
    gap: 14,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#171717',
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
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  recipeMeta: {
    color: '#B8B8B8',
    fontSize: 13,
    fontWeight: '700',
  },
  recipeNumber: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#2A2A2A',
  },
  recipeNumberText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  recipeSection: {
    gap: 6,
    backgroundColor: 'transparent',
  },
  recipeSectionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  recipeTitle: {
    color: '#FFFFFF',
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
    borderColor: '#2A2A2A',
    backgroundColor: '#101010',
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: '#FFFFFF',
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
  textInput: {
    minHeight: 54,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#101010',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },
  titleCopy: {
    flex: 1,
    gap: 5,
    backgroundColor: 'transparent',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  whyBox: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#102017',
    borderWidth: 1,
    borderColor: '#235D38',
  },
  whyText: {
    color: '#BBF7D0',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
});
