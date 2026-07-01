import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useAuth } from '@/contexts/AuthContext';
import { DespensaItemData, fetchDespensa } from '@/services/despensa';
import {
  BudgetPurchaseSuggestion,
  GeneratedRecipe,
  fetchRecipeHistory,
  generateBudgetRecipe,
  generateRecipes,
  prepareRecipeForUser,
  saveUsedRecipe,
} from '@/services/recipes';
import { savePreparationRecipe } from '@/services/preparation';
import { appendShoppingItems, createShoppingItem } from '@/services/shoppingList';
import { UserBudget, fetchBudget, spendBudget } from '@/services/budget';

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
  supermercado_id?: string | null;
  supermercado_nombre?: string | null;
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

function parseRestrictionInput(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getRecipePurchaseNames(recipe: GeneratedRecipe, suggestions: PurchaseSuggestion[] = []) {
  const explicitPurchases = (recipe.compras_usadas || []).filter(Boolean);
  if (explicitPurchases.length > 0) {
    return explicitPurchases;
  }

  const ingredientText = normalizeText((recipe.ingredientes || []).join(' '));
  return suggestions
    .filter((item) => ingredientText.includes(normalizeText(item.nombre)))
    .map((item) => item.nombre);
}

function textMatches(left: string, right: string) {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);
  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  );
}

function getRecipePurchaseCost(recipe: GeneratedRecipe, suggestions: PurchaseSuggestion[] = []) {
  const usedPurchases = getRecipePurchaseNames(recipe, suggestions);
  return suggestions
    .filter((item) => usedPurchases.some((name) => textMatches(name, item.nombre)))
    .reduce((sum, item) => sum + item.precio, 0);
}

function getRecipePurchaseItems(recipe: GeneratedRecipe, suggestions: PurchaseSuggestion[] = []) {
  const usedPurchases = getRecipePurchaseNames(recipe, suggestions);
  return suggestions.filter((item) => usedPurchases.some((name) => textMatches(name, item.nombre)));
}

function formatHistoryDate(value?: string) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long' }).format(date);
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
  const [profileBudget, setProfileBudget] = useState<UserBudget | null>(null);
  const [useProfileBudget, setUseProfileBudget] = useState(true);
  const [purchaseSuggestions, setPurchaseSuggestions] = useState<PurchaseSuggestion[]>([]);
  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [objective, setObjective] = useState('');
  const [customRestrictionsInput, setCustomRestrictionsInput] = useState('');
  const [useProfileRestrictions, setUseProfileRestrictions] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [recipes, setRecipes] = useState<GeneratedRecipe[]>([]);
  const [generationTimeMs, setGenerationTimeMs] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [budgetSpendMessage, setBudgetSpendMessage] = useState('');
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<GeneratedRecipe[]>([]);
  const [usingRecipeKey, setUsingRecipeKey] = useState<string | null>(null);
  const modeTransition = useRef(new Animated.Value(1)).current;
  const modePillAnim = useRef(new Animated.Value(0)).current;
  const [modeSwitchWidth, setModeSwitchWidth] = useState(0);

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

  const loadProfileBudget = useCallback(async () => {
    if (!user?.id) return;
    const result = await fetchBudget(user.id);
    if (result.budget) {
      setProfileBudget(result.budget);
      setUseProfileBudget(true);
    } else {
      setProfileBudget(null);
      setUseProfileBudget(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadDespensa();
    loadProfileBudget();
  }, [loadDespensa, loadProfileBudget]);

  useFocusEffect(
    useCallback(() => {
      loadDespensa();
      loadProfileBudget();
    }, [loadDespensa, loadProfileBudget])
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
  const profileBudgetAvailable = useMemo(
    () => profileBudget ? Number(profileBudget.monto || 0) - Number(profileBudget.gastado || 0) : 0,
    [profileBudget]
  );

  const userRestrictions = useMemo(
    () => (user?.restricciones || []).filter((item) => item.trim().length > 0),
    [user?.restricciones]
  );

  const customRestrictions = useMemo(
    () => parseRestrictionInput(customRestrictionsInput),
    [customRestrictionsInput]
  );

  const activeRestrictions = useMemo(
    () => {
      const source = useProfileRestrictions ? [...userRestrictions, ...customRestrictions] : customRestrictions;
      const seen = new Set<string>();
      return source.filter((item) => {
        const key = normalizeText(item);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
    [customRestrictions, useProfileRestrictions, userRestrictions]
  );

  const budgetRecipePurchaseNames = useMemo(
    () =>
      recipeMode === 'presupuesto' && recipes.length > 0
        ? recipes.flatMap((recipe) => getRecipePurchaseNames(recipe, purchaseSuggestions))
        : [],
    [purchaseSuggestions, recipeMode, recipes]
  );

  const budgetRecipeCosts = useMemo(
    () =>
      recipeMode === 'presupuesto'
        ? recipes.map((recipe) => getRecipePurchaseCost(recipe, purchaseSuggestions))
        : [],
    [purchaseSuggestions, recipeMode, recipes]
  );

  const maxBudgetRecipeCost = useMemo(
    () => Math.max(0, ...budgetRecipeCosts),
    [budgetRecipeCosts]
  );

  const minBudgetRecipeCost = useMemo(
    () => (budgetRecipeCosts.length > 0 ? Math.min(...budgetRecipeCosts) : 0),
    [budgetRecipeCosts]
  );

  const groupedHistory = useMemo(() => {
    const groups: Array<{ date: string; recipes: GeneratedRecipe[] }> = [];
    const byDate = new Map<string, GeneratedRecipe[]>();
    for (const recipe of historyItems) {
      const key = formatHistoryDate(recipe.created_at);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(recipe);
    }
    byDate.forEach((itemsForDate, date) => groups.push({ date, recipes: itemsForDate }));
    return groups;
  }, [historyItems]);

  function toggleIngredient(itemId: string) {
    setError('');
    setSelectedIngredientIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  }

  function switchRecipeMode(mode: RecipeMode) {
    if (mode === recipeMode) return;

    Animated.spring(modePillAnim, {
      toValue: mode === 'presupuesto' ? 1 : 0,
      damping: 18,
      mass: 0.7,
      stiffness: 190,
      useNativeDriver: true,
    }).start();

    Animated.timing(modeTransition, {
      toValue: 0,
      duration: 150,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setRecipeMode(mode);
      setRecipes([]);
      setGenerationTimeMs(null);
      setError('');
      Animated.spring(modeTransition, {
        toValue: 1,
        damping: 16,
        mass: 0.75,
        stiffness: 190,
        useNativeDriver: true,
      }).start();
    });
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
    setGenerationTimeMs(null);
    const generationStartedAt = Date.now();

    const result = await generateRecipes({
      user_id: user.id,
      tipo_comida: selectedMeal,
      ingredientes: selectedIngredients.map((item) => item.nombre_producto),
      objetivo_nutricional: objective.trim(),
      restricciones: customRestrictions,
      usar_restricciones_perfil: useProfileRestrictions,
    });

    if (result.error) {
      setError(result.error);
    } else if (result.recetas?.length) {
      setRecipes(result.recetas.slice(0, 3));
      setGenerationTimeMs(Date.now() - generationStartedAt);
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
    const budget = useProfileBudget && profileBudget ? profileBudgetAvailable : parseBudget(budgetInput);
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
    setGenerationTimeMs(null);
    setPurchaseSuggestions([]);
    setSelectedPurchaseIds([]);
    const generationStartedAt = Date.now();

    const result = await generateBudgetRecipe({
      user_id: user.id,
      tipo_comida: selectedMeal,
      presupuesto: budget,
      ingredientes: selectedIngredients.map((item) => item.nombre_producto),
      objetivo_nutricional: objective.trim(),
      restricciones: customRestrictions,
      usar_restricciones_perfil: useProfileRestrictions,
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
        supermercado_id: item.supermercado_id,
        supermercado_nombre: item.supermercado_nombre,
        mealTypes: [selectedMeal],
        reason: item.reason || 'Complementa tu despensa para esta receta.',
      }));
      setPurchaseSuggestions(suggestions);
      setSelectedPurchaseIds(suggestions.map((item) => item.id));
      setRecipes(result.recetas?.slice(0, 3) || []);
      if (result.recetas?.length) {
        setGenerationTimeMs(Date.now() - generationStartedAt);
      }

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
          supermercado_id: item.supermercado_id,
          supermercado_nombre: item.supermercado_nombre,
        })
      )
    );
    setError('');
    router.push('/(navbarnt)/lista');
  }

  async function discountSelectedFromBudget() {
    if (!user?.id) {
      setError('No hay usuario activo.');
      return;
    }
    if (selectedPurchaseTotal <= 0) {
      setError('No hay compras seleccionadas para descontar.');
      return;
    }

    const result = await spendBudget({
      user_id: user.id,
      monto: selectedPurchaseTotal,
      descripcion: 'Compras sugeridas desde receta presupuestada',
    });

    if (result.error) {
      setError(result.error);
    } else {
      setBudgetSpendMessage(`Se descontaron ${formatPrice(selectedPurchaseTotal)} de tu presupuesto.`);
      setError('');
    }
  }

  async function openHistory() {
    if (!user?.id) {
      setError('No hay usuario activo para revisar historial.');
      return;
    }

    setHistoryVisible(true);
    setHistoryLoading(true);
    const result = await fetchRecipeHistory(user.id);
    if (result.items) {
      setHistoryItems(result.items);
    } else if (result.error) {
      setError(result.error);
    }
    setHistoryLoading(false);
  }

  async function useRecipe(recipe: GeneratedRecipe, saveToHistory = true, recipeKey = recipe.id || recipe.titulo) {
    if (!user?.id) {
      setError('No hay usuario activo para usar esta receta.');
      return;
    }

    setUsingRecipeKey(recipeKey);
    setError('');

    let recipeToPrepare = recipe;
    if (saveToHistory) {
      const recipePurchaseCost = getRecipePurchaseCost(recipe, purchaseSuggestions);
      const saved = await saveUsedRecipe({
        user_id: user.id,
        receta: recipe,
        tipo_comida: selectedMeal,
        prompt_usado: [selectedMeal, objective.trim(), activeRestrictions.join(', ')].filter(Boolean).join(' · '),
        costo_estimado: recipeMode === 'presupuesto' ? recipePurchaseCost : undefined,
      });

      if (saved.error) {
        setError(saved.error);
        setUsingRecipeKey(null);
        return;
      }
      recipeToPrepare = saved.receta || recipe;
    }

    const prepared = await prepareRecipeForUser({
      user_id: user.id,
      receta: recipeToPrepare,
    });

    if (prepared.error) {
      setError(prepared.error);
      setUsingRecipeKey(null);
      return;
    }

    await savePreparationRecipe({
      receta: prepared.receta || recipeToPrepare,
      compras_sugeridas: prepared.compras_sugeridas || [],
      compras_receta: prepared.compras_receta || [],
      restricciones: activeRestrictions,
      tipo_comida: selectedMeal,
    });
    setUsingRecipeKey(null);
    setHistoryVisible(false);
    router.push('/(navbarnt)/preparacion');
  }

  function renderRestrictionsSection(compact = false) {
    const panelStyles = compact ? styles.budgetSharedSection : styles.detailPanel;
    const titleStyle = compact ? styles.panelTitleSmall : styles.panelTitle;
    const iconSize = compact ? 20 : 22;
    const iconStyle = compact ? styles.panelIconSmall : styles.panelIcon;

    return (
      <View style={panelStyles}>
        <View style={styles.panelHeader}>
          <View style={iconStyle}>
            <MaterialCommunityIcons name="food-off-outline" size={iconSize} color="#064E2F" />
          </View>
          <View style={styles.panelCopy}>
            <Text style={titleStyle}>Restricciones</Text>
            <Text style={styles.panelSubtitle}>
              {activeRestrictions.length > 0
                ? `Aplicando: ${activeRestrictions.join(', ')}`
                : 'Sin restricciones para esta generación'}
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: useProfileRestrictions }}
          onPress={() => setUseProfileRestrictions((prev) => !prev)}
          style={styles.restrictionToggle}>
          <View style={[styles.restrictionSwitch, useProfileRestrictions && styles.restrictionSwitchOn]}>
            <View style={[styles.restrictionSwitchKnob, useProfileRestrictions && styles.restrictionSwitchKnobOn]} />
          </View>
          <View style={styles.panelCopy}>
            <Text style={styles.restrictionToggleTitle}>Usar restricciones del perfil</Text>
            <Text style={styles.restrictionToggleText}>
              {userRestrictions.length > 0 ? userRestrictions.join(', ') : 'No tienes restricciones guardadas'}
            </Text>
          </View>
        </Pressable>

        <TextInput
          onChangeText={setCustomRestrictionsInput}
          placeholder="Agregar para esta receta, ej: sin lactosa, sin gluten"
          placeholderTextColor="#43A66C"
          style={styles.textInput}
          value={customRestrictionsInput}
        />

        {activeRestrictions.length > 0 && (
          <View style={styles.restrictionChipRow}>
            {activeRestrictions.map((restriction) => (
              <Text key={restriction} style={styles.restrictionChip}>
                {restriction}
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroTitleRow}>
            <Text style={styles.title}>Generar receta</Text>
            <Pressable accessibilityLabel="Historial de recetas" accessibilityRole="button" onPress={openHistory} style={styles.historyButton}>
              <MaterialCommunityIcons name="history" size={23} color="#064E2F" />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>Elige tipo de comida e ingredientes obligatorios que la IA debe usar, como arroz o pollo.</Text>
        </View>

        <View
          style={styles.modeSwitch}
          onLayout={(event) => setModeSwitchWidth(event.nativeEvent.layout.width)}>
          {modeSwitchWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.modeSlidingPill,
                {
                  width: (modeSwitchWidth - 12 - 8) / 2,
                  transform: [
                    {
                      translateX: modePillAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [6, 6 + (modeSwitchWidth - 12 - 8) / 2 + 8],
                      }),
                    },
                  ],
                },
              ]}
            />
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => switchRecipeMode('despensa')}
            style={styles.modeButton}>
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
            onPress={() => switchRecipeMode('presupuesto')}
            style={styles.modeButton}>
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

        <Animated.View
          style={[
            styles.modeContent,
            {
              opacity: modeTransition,
              transform: [
                {
                  translateX: modeTransition.interpolate({
                    inputRange: [0, 1],
                    outputRange: [recipeMode === 'presupuesto' ? 32 : -32, 0],
                  }),
                },
                {
                  scale: modeTransition.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.97, 1],
                  }),
                },
              ],
            },
          ]}>
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

            {renderRestrictionsSection()}

            <View style={styles.detailPanel}>
              <View style={styles.panelHeader}>
                <View style={styles.panelIcon}>
                  <MaterialCommunityIcons name="fridge-outline" size={22} color="#064E2F" />
                </View>
                <View style={styles.panelCopy}>
                  <Text style={styles.panelTitle}>Ingredientes obligatorios</Text>
                  <Text style={styles.panelSubtitle}>
                    {selectedIngredients.length > 0
                      ? `${selectedIngredients.length} obligatorio${selectedIngredients.length === 1 ? '' : 's'}`
                      : 'Elige si quieres forzar alguno, por ejemplo arroz'}
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

            <View style={styles.budgetSharedSection}>
              <View style={styles.panelHeader}>
                <View style={styles.panelIconSmall}>
                  <MaterialCommunityIcons name="silverware" size={20} color="#064E2F" />
                </View>
                <View style={styles.panelCopy}>
                  <Text style={styles.panelTitleSmall}>Tipo de comida</Text>
                  <Text style={styles.panelSubtitle}>{selectedMealType.label}</Text>
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

            <View style={styles.budgetSharedSection}>
              <View style={styles.panelHeader}>
                <View style={styles.panelIconSmall}>
                  <MaterialCommunityIcons name="target" size={20} color="#064E2F" />
                </View>
                <View style={styles.panelCopy}>
                  <Text style={styles.panelTitleSmall}>Objetivo</Text>
                  <Text style={styles.panelSubtitle}>Opcional para guiar compras y receta.</Text>
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

            {renderRestrictionsSection(true)}

            <View style={styles.budgetSharedSection}>
              <View style={styles.panelHeader}>
                <View style={styles.panelIconSmall}>
                  <MaterialCommunityIcons name="fridge-outline" size={20} color="#064E2F" />
                </View>
                <View style={styles.panelCopy}>
                  <Text style={styles.panelTitleSmall}>Ingredientes obligatorios</Text>
                  <Text style={styles.panelSubtitle}>
                    {selectedIngredients.length > 0
                      ? `${selectedIngredients.length} obligatorio${selectedIngredients.length === 1 ? '' : 's'}`
                      : 'Elige si quieres forzar alguno, por ejemplo arroz'}
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

            <View style={styles.budgetInputRow}>
              {profileBudget && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setUseProfileBudget((prev) => !prev)}
                  style={[styles.profileBudgetToggle, useProfileBudget && styles.profileBudgetToggleActive]}>
                  <MaterialCommunityIcons name={useProfileBudget ? 'check-circle' : 'circle-outline'} size={20} color="#064E2F" />
                  <Text style={styles.profileBudgetToggleText}>
                    Usar perfil: {formatPrice(profileBudgetAvailable)}
                  </Text>
                </Pressable>
              )}
              <View style={styles.budgetInputBox}>
                <Text style={styles.budgetLabel}>Presupuesto</Text>
                <TextInput
                  editable={!useProfileBudget}
                  keyboardType="numeric"
                  onChangeText={setBudgetInput}
                  placeholder={useProfileBudget && profileBudget ? formatPrice(profileBudgetAvailable) : 'Ej: 12000'}
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
              {activeRestrictions.length > 0 && (
                <Text style={styles.budgetContextText}>Respeta: {activeRestrictions.join(', ')}</Text>
              )}
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
                  const isUsedInRecipe = budgetRecipePurchaseNames.some(
                    (name) => textMatches(name, item.nombre)
                  );
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
                        <Text style={styles.ingredientSubtitle}>
                          {[item.cantidad, item.supermercado_nombre, item.reason].filter(Boolean).join(' · ')}
                        </Text>
                        {isUsedInRecipe && (
                          <View style={styles.purchaseRecipeBadge}>
                            <MaterialCommunityIcons name="silverware-fork-knife" size={13} color="#FBFFF8" />
                            <Text style={styles.purchaseRecipeBadgeText}>Se usa en la receta</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.pricePill}>{formatPrice(item.precio)}</Text>
                    </Pressable>
                  );
                })}

                <Pressable accessibilityRole="button" onPress={addSuggestionsToShoppingList} style={styles.budgetLink}>
                  <MaterialCommunityIcons name="cart-arrow-right" size={20} color="#FBFFF8" />
                  <Text style={styles.budgetLinkText}>Mandar a lista de compras</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={discountSelectedFromBudget} style={styles.listGhostLink}>
                  <Text style={styles.listGhostLinkText}>Descontar del presupuesto</Text>
                </Pressable>
                {budgetSpendMessage !== '' && <Text style={styles.ingredientSubtitle}>{budgetSpendMessage}</Text>}
                <Pressable accessibilityRole="button" onPress={() => router.push('/(navbarnt)/lista')} style={styles.listGhostLink}>
                  <Text style={styles.listGhostLinkText}>Ver lista actual</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
        </Animated.View>

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
              <View style={styles.resultsTitleWrap}>
                <Text style={styles.sectionTitle}>Resultados</Text>
                {generationTimeMs !== null && (
                  <Text style={styles.generationTimeText}>Generado en {(generationTimeMs / 1000).toFixed(1).replace('.', ',')} s</Text>
                )}
              </View>
              <Text style={styles.sectionMeta}>{recipes.length} receta{recipes.length === 1 ? '' : 's'}</Text>
            </View>

            {recipes.map((recipe, index) => {
              const usedPurchases =
                recipeMode === 'presupuesto' ? getRecipePurchaseNames(recipe, purchaseSuggestions) : [];
              const recipePurchaseCost = budgetRecipeCosts[index] ?? 0;
              const costRatio =
                recipeMode === 'presupuesto' && maxBudgetRecipeCost > 0
                  ? Math.max(0.08, recipePurchaseCost / maxBudgetRecipeCost)
                  : 0;
              const isCheapestBudgetRecipe =
                recipeMode === 'presupuesto' && recipePurchaseCost === minBudgetRecipeCost;
              const costFillWidth = `${Math.round(costRatio * 100)}%` as `${number}%`;

              return (
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
                  <Pressable
                    accessibilityRole="button"
                    disabled={usingRecipeKey === `${recipe.titulo}-${index}`}
                    onPress={() => useRecipe(recipe, true, `${recipe.titulo}-${index}`)}
                    style={styles.useRecipeButton}>
                    {usingRecipeKey === `${recipe.titulo}-${index}` ? (
                      <ActivityIndicator size="small" color="#FBFFF8" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="play-circle-outline" size={18} color="#FBFFF8" />
                        <Text style={styles.useRecipeButtonText}>Usar</Text>
                      </>
                    )}
                  </Pressable>
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

                {recipeMode === 'presupuesto' && (
                  <View style={styles.recipeCostMeter}>
                    <View style={styles.recipeCostHeader}>
                      <View style={styles.recipeCostTitleWrap}>
                        <MaterialCommunityIcons name="cart-check" size={18} color="#064E2F" />
                        <Text style={styles.recipeCostTitle}>Costo y compras usadas</Text>
                      </View>
                      <View style={styles.recipeCostValueWrap}>
                        {isCheapestBudgetRecipe && (
                          <Text style={styles.recipeCostBestPill}>
                            {recipePurchaseCost === 0 ? 'Sin compras' : 'Más barata'}
                          </Text>
                        )}
                        <Text style={styles.recipeCostValue}>{formatPrice(recipePurchaseCost)}</Text>
                      </View>
                    </View>
                    <View style={styles.recipeCostTrack}>
                      <View style={[styles.recipeCostFill, { width: costFillWidth }]} />
                    </View>
                    <Text style={styles.recipeCostMeta}>
                      {usedPurchases.length > 0
                        ? `${usedPurchases.length} compra${usedPurchases.length === 1 ? '' : 's'} usada${usedPurchases.length === 1 ? '' : 's'} en esta receta`
                        : 'Usa solo lo que ya tienes en despensa'}
                    </Text>
                    {usedPurchases.length > 0 && (
                      <View style={styles.recipePurchaseChipRow}>
                        {usedPurchases.map((purchaseName, purchaseIndex) => (
                          <Text key={`${purchaseName}-${purchaseIndex}`} style={styles.recipePurchaseChip}>
                            {purchaseName}
                          </Text>
                        ))}
                      </View>
                    )}
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
              );
            })}
          </View>
        )}

      </ScrollView>

      <Modal animationType="slide" transparent visible={historyVisible} onRequestClose={() => setHistoryVisible(false)}>
        <View style={styles.historyBackdrop}>
          <View style={styles.historySheet}>
            <View style={styles.historyHeader}>
              <View style={styles.historyTitleWrap}>
                <Text style={styles.historyTitle}>Historial</Text>
                <Text style={styles.historySubtitle}>Recetas que usaste, ordenadas por fecha.</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setHistoryVisible(false)} style={styles.historyCloseButton}>
                <MaterialCommunityIcons name="close" size={22} color="#064E2F" />
              </Pressable>
            </View>

            {historyLoading ? (
              <View style={styles.historyEmpty}>
                <ActivityIndicator size="large" color="#064E2F" />
              </View>
            ) : historyItems.length === 0 ? (
              <View style={styles.historyEmpty}>
                <MaterialCommunityIcons name="history" size={38} color="#43A66C" />
                <Text style={styles.emptyText}>Todavía no hay recetas usadas.</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.historyList}>
                {groupedHistory.map((group) => (
                  <View key={group.date} style={styles.historyGroup}>
                    <View style={styles.historyDateRow}>
                      <Text style={styles.historyDate}>{group.date}</Text>
                      <View style={styles.historyDateLine} />
                    </View>
                    {group.recipes.map((recipe) => {
                      const key = recipe.id || recipe.titulo;
                      return (
                        <View key={key} style={styles.historyCard}>
                          <View style={styles.historyRecipeCopy}>
                            <Text style={styles.historyRecipeTitle}>{recipe.titulo}</Text>
                            <Text style={styles.historyRecipeMeta}>
                              {[recipe.tiempo_preparacion, recipe.costo_estimado ? formatPrice(recipe.costo_estimado) : undefined]
                                .filter(Boolean)
                                .join(' · ') || `${recipe.ingredientes?.length || 0} ingredientes`}
                            </Text>
                          </View>
                          <Pressable
                            accessibilityRole="button"
                            disabled={usingRecipeKey === key}
                            onPress={() => useRecipe(recipe, false, key)}
                            style={styles.historyUseButton}>
                            {usingRecipeKey === key ? (
                              <ActivityIndicator size="small" color="#FBFFF8" />
                            ) : (
                              <>
                                <MaterialCommunityIcons name="play-circle-outline" size={17} color="#FBFFF8" />
                                <Text style={styles.historyUseButtonText}>Usar</Text>
                              </>
                            )}
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
    flexWrap: 'wrap',
    alignItems: 'stretch',
    gap: 10,
    backgroundColor: 'transparent',
  },
  budgetSharedSection: {
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
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
  generationTimeText: {
    color: '#4F9F70',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  hero: {
    gap: 14,
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: 'transparent',
  },
  historyBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(6, 78, 47, 0.28)',
  },
  historyButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  historyCard: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  historyCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#DDF8E7',
  },
  historyDate: {
    color: '#064E2F',
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  historyDateLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#74D997',
  },
  historyDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  historyEmpty: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  historyGroup: {
    gap: 9,
    backgroundColor: 'transparent',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  historyList: {
    gap: 18,
    paddingBottom: 24,
  },
  historyRecipeCopy: {
    flex: 1,
    gap: 4,
    backgroundColor: 'transparent',
  },
  historyRecipeMeta: {
    color: '#2F7A4F',
    fontSize: 12,
    fontWeight: '700',
  },
  historyRecipeTitle: {
    color: '#064E2F',
    fontSize: 15,
    fontWeight: '900',
  },
  historySheet: {
    maxHeight: '82%',
    gap: 16,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: '#FBFFF8',
  },
  historySubtitle: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '700',
  },
  historyTitle: {
    color: '#064E2F',
    fontSize: 24,
    fontWeight: '900',
  },
  historyTitleWrap: {
    flex: 1,
    gap: 3,
    backgroundColor: 'transparent',
  },
  historyUseButton: {
    minHeight: 38,
    minWidth: 78,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#00B86B',
  },
  historyUseButtonText: {
    color: '#FBFFF8',
    fontSize: 12,
    fontWeight: '900',
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
    zIndex: 1,
  },
  modeButtonActive: {
    backgroundColor: 'transparent',
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
    overflow: 'hidden',
  },
  modeSlidingPill: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 0,
    borderRadius: 16,
    backgroundColor: '#00B86B',
    shadowColor: '#00B86B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 3,
  },
  modeContent: {
    gap: 18,
    backgroundColor: 'transparent',
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
  panelIconSmall: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
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
  panelTitleSmall: {
    color: '#064E2F',
    fontSize: 15,
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
  preparationActions: {
    gap: 10,
    backgroundColor: 'transparent',
  },
  preparationHero: {
    gap: 4,
    padding: 13,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#74D997',
    backgroundColor: '#D8FBE3',
  },
  preparationMessage: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 15,
    backgroundColor: '#D8FBE3',
  },
  preparationMessageText: {
    flex: 1,
    color: '#064E2F',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  preparationMeta: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '800',
  },
  preparationPanel: {
    gap: 14,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
    shadowColor: '#74D997',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 20,
    elevation: 2,
  },
  preparationPrimaryButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    backgroundColor: '#00B86B',
  },
  preparationPrimaryButtonText: {
    color: '#FBFFF8',
    fontSize: 14,
    fontWeight: '900',
  },
  preparationRecipeTab: {
    minWidth: 42,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  preparationRecipeTabSelected: {
    borderColor: '#00B86B',
    backgroundColor: '#00B86B',
  },
  preparationRecipeTabText: {
    color: '#064E2F',
    fontSize: 14,
    fontWeight: '900',
  },
  preparationRecipeTabTextSelected: {
    color: '#FBFFF8',
  },
  preparationRecipeTabs: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'transparent',
  },
  preparationSecondaryButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#74D997',
    backgroundColor: '#D8FBE3',
  },
  preparationSecondaryButtonText: {
    color: '#064E2F',
    fontSize: 14,
    fontWeight: '900',
  },
  preparationStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 11,
    borderRadius: 16,
    backgroundColor: '#DDF8E7',
  },
  preparationStepNumber: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#9FE7B9',
  },
  preparationStepNumberText: {
    color: '#064E2F',
    fontSize: 12,
    fontWeight: '900',
  },
  preparationStepText: {
    flex: 1,
    color: '#0B6B40',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  preparationSteps: {
    gap: 9,
    backgroundColor: 'transparent',
  },
  preparationTitle: {
    color: '#064E2F',
    fontSize: 18,
    fontWeight: '900',
  },
  profileBudgetToggle: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  profileBudgetToggleActive: {
    borderColor: '#00B86B',
    backgroundColor: '#D8FBE3',
  },
  profileBudgetToggleText: {
    color: '#064E2F',
    fontSize: 13,
    fontWeight: '900',
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
  purchaseRecipeBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#00B86B',
  },
  purchaseRecipeBadgeText: {
    color: '#FBFFF8',
    fontSize: 11,
    fontWeight: '900',
  },
  recipeCard: {
    gap: 14,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  recipeAdjustBox: {
    gap: 11,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  recipeAdjustButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    backgroundColor: '#00B86B',
  },
  recipeAdjustButtonText: {
    color: '#FBFFF8',
    fontSize: 14,
    fontWeight: '900',
  },
  recipeAdjustInput: {
    minHeight: 86,
    color: '#064E2F',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
    textAlignVertical: 'top',
  },
  recipeCostBestPill: {
    color: '#FBFFF8',
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#00B86B',
    overflow: 'hidden',
  },
  recipeCostFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#00B86B',
  },
  recipeCostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: 'transparent',
  },
  recipeCostMeta: {
    color: '#2F7A4F',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  recipeCostMeter: {
    gap: 9,
    padding: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#74D997',
    backgroundColor: '#D8FBE3',
  },
  recipeCostTitle: {
    color: '#064E2F',
    fontSize: 14,
    fontWeight: '900',
  },
  recipeCostTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'transparent',
  },
  recipeCostTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#B8EEC8',
    overflow: 'hidden',
  },
  recipeCostValue: {
    color: '#064E2F',
    fontSize: 14,
    fontWeight: '900',
  },
  recipeCostValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 7,
    backgroundColor: 'transparent',
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
  recipePurchaseChip: {
    color: '#064E2F',
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#9FE7B9',
    overflow: 'hidden',
  },
  recipePurchaseChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    backgroundColor: 'transparent',
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
  resultsTitleWrap: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  restrictionChip: {
    color: '#064E2F',
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#9FE7B9',
    overflow: 'hidden',
  },
  restrictionChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    backgroundColor: 'transparent',
  },
  restrictionSwitch: {
    width: 44,
    height: 26,
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderRadius: 999,
    backgroundColor: '#9FE7B9',
  },
  restrictionSwitchKnob: {
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: '#FBFFF8',
  },
  restrictionSwitchKnobOn: {
    alignSelf: 'flex-end',
  },
  restrictionSwitchOn: {
    backgroundColor: '#00B86B',
  },
  restrictionToggle: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  restrictionToggleText: {
    color: '#2F7A4F',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  restrictionToggleTitle: {
    color: '#064E2F',
    fontSize: 14,
    fontWeight: '900',
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
  useRecipeButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#00B86B',
  },
  useRecipeButtonText: {
    color: '#FBFFF8',
    fontSize: 12,
    fontWeight: '900',
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
