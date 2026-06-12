import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useAuth } from '@/contexts/AuthContext';
import { actualizarIngrediente, DespensaItemData, fetchDespensa } from '@/services/despensa';
import { getPreparationRecipe, PreparationPayload, savePreparationRecipe } from '@/services/preparation';
import { adjustRecipe, BudgetPurchaseSuggestion, GeneratedRecipe } from '@/services/recipes';
import { createShoppingItem, getPreparationShoppingItems, savePreparationShoppingItems } from '@/services/shoppingList';

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
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

function parseIngredientAmount(ingredientLine: string) {
  const match = ingredientLine.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return 1;
  const parsed = Number(match[1].replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function getRecipePurchaseNames(recipe: GeneratedRecipe, suggestions: BudgetPurchaseSuggestion[] = []) {
  const explicitPurchases = (recipe.compras_usadas || []).filter(Boolean);
  if (explicitPurchases.length > 0) {
    return explicitPurchases;
  }

  const ingredientText = normalizeText((recipe.ingredientes || []).join(' '));
  return suggestions
    .filter((item) => ingredientText.includes(normalizeText(item.nombre)))
    .map((item) => item.nombre);
}

function getRecipePurchaseItems(recipe: GeneratedRecipe, suggestions: BudgetPurchaseSuggestion[] = []) {
  const usedPurchases = getRecipePurchaseNames(recipe, suggestions);
  return suggestions.filter((item) => usedPurchases.some((name) => textMatches(name, item.nombre)));
}

type PrepSurface = 'preparacion' | 'lista';

export default function PreparationScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [payload, setPayload] = useState<PreparationPayload | null>(null);
  const [items, setItems] = useState<DespensaItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deductingPantry, setDeductingPantry] = useState(false);
  const [recipeChangeRequest, setRecipeChangeRequest] = useState('');
  const [adjustingRecipe, setAdjustingRecipe] = useState(false);
  const [message, setMessage] = useState('');
  const [bridgeTarget, setBridgeTarget] = useState<PrepSurface>('preparacion');
  const [bridgeWidth, setBridgeWidth] = useState(0);
  const bridgePillAnim = useRef(new Animated.Value(0)).current;
  const surfaceTransition = useRef(new Animated.Value(0)).current;

  const recipe = payload?.receta;
  const purchaseSuggestions = payload?.compras_sugeridas || [];
  const recipePurchases = payload?.compras_receta || [];
  const activePurchases = useMemo(
    () => {
      if (recipePurchases.length > 0) return recipePurchases;
      return recipe ? getRecipePurchaseItems(recipe, purchaseSuggestions) : [];
    },
    [purchaseSuggestions, recipe, recipePurchases]
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      async function loadPreparation() {
        setLoading(true);
        const storedPayload = await getPreparationRecipe();
        if (isActive) setPayload(storedPayload);

        if (user?.id) {
          const pantry = await fetchDespensa(user.id);
          if (isActive && pantry.items) setItems(pantry.items);
          if (isActive && pantry.error) setMessage(pantry.error);
        }
        if (isActive) setLoading(false);
      }

      loadPreparation();
      return () => {
        isActive = false;
      };
    }, [user?.id])
  );

  useEffect(() => {
    Animated.spring(surfaceTransition, {
      toValue: 1,
      damping: 16,
      mass: 0.75,
      stiffness: 190,
      useNativeDriver: true,
    }).start();
  }, [surfaceTransition]);

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/recipe');
  }

  function switchPreparationSurface(target: PrepSurface) {
    if (target === 'preparacion') return;

    setBridgeTarget(target);
    Animated.spring(bridgePillAnim, {
      toValue: 1,
      damping: 18,
      mass: 0.7,
      stiffness: 190,
      useNativeDriver: true,
    }).start();

    Animated.timing(surfaceTransition, {
      toValue: 0,
      duration: 150,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      router.replace('/(navbarnt)/lista?modo=preparacion');
    });
  }

  async function addPurchasesToShoppingList() {
    if (activePurchases.length === 0) {
      setMessage('Esta receta no necesita compras adicionales.');
      return;
    }

    const currentItems = await getPreparationShoppingItems();
    const nextItems = [...currentItems];
    let addedCount = 0;

    activePurchases.forEach((item) => {
      const alreadyExists = nextItems.some(
        (currentItem) =>
          normalizeText(currentItem.nombre) === normalizeText(item.nombre) &&
          normalizeText(currentItem.cantidad) === normalizeText(item.cantidad)
      );

      if (!alreadyExists) {
        nextItems.push(
          createShoppingItem({
          nombre: item.nombre,
          categoria: item.categoria,
          cantidad: item.cantidad,
          precio: item.precio,
        })
        );
        addedCount += 1;
      }
    });

    await savePreparationShoppingItems(nextItems);
    setMessage(
      addedCount > 0
        ? `${addedCount} compra${addedCount === 1 ? '' : 's'} agregada${addedCount === 1 ? '' : 's'} a la lista.`
        : 'Estas compras ya estaban en tu lista.'
    );
  }

  async function deductRecipeFromPantry() {
    if (!recipe?.ingredientes?.length) {
      setMessage('No hay ingredientes para descontar.');
      return;
    }

    setDeductingPantry(true);
    setMessage('');

    const usageByItem = new Map<string, { item: DespensaItemData; amount: number }>();
    recipe.ingredientes.forEach((ingredientLine) => {
      const pantryItem = items.find((item) => textMatches(ingredientLine, item.nombre_producto));
      if (!pantryItem || pantryItem.cantidad === undefined || pantryItem.cantidad === null) return;
      const currentUsage = usageByItem.get(pantryItem.id)?.amount ?? 0;
      usageByItem.set(pantryItem.id, {
        item: pantryItem,
        amount: currentUsage + parseIngredientAmount(ingredientLine),
      });
    });

    if (usageByItem.size === 0) {
      setMessage('No pude cruzar esta receta con cantidades de tu despensa.');
      setDeductingPantry(false);
      return;
    }

    const updatedItems = [...items];
    let updatedCount = 0;
    for (const { item, amount } of usageByItem.values()) {
      const nextAmount = Math.max(0, Number(item.cantidad || 0) - amount);
      const result = await actualizarIngrediente(item.id, { cantidad: nextAmount });
      if (result.error) {
        setMessage(result.error);
        setDeductingPantry(false);
        return;
      }
      const itemIndex = updatedItems.findIndex((candidate) => candidate.id === item.id);
      if (itemIndex >= 0) {
        updatedItems[itemIndex] = { ...updatedItems[itemIndex], cantidad: nextAmount };
      }
      updatedCount += 1;
    }

    setItems(updatedItems);
    setMessage(`Despensa actualizada: ${updatedCount} ingrediente${updatedCount === 1 ? '' : 's'} descontado${updatedCount === 1 ? '' : 's'}.`);
    setDeductingPantry(false);
  }

  async function handleAdjustRecipe() {
    if (!payload?.receta) return;
    if (!recipeChangeRequest.trim()) {
      setMessage('Escribe qué quieres cambiar de la receta.');
      return;
    }

    setAdjustingRecipe(true);
    setMessage('');
    const result = await adjustRecipe({
      receta: payload.receta,
      cambios: recipeChangeRequest.trim(),
      restricciones: payload.restricciones,
      compras_sugeridas: payload.compras_sugeridas,
    });

    if (result.error) {
      setMessage(result.error);
    } else if (result.recetas?.[0]) {
      const nextRecipe = result.recetas[0];
      const nextPayload = {
        ...payload,
        receta: nextRecipe,
        compras_receta: getRecipePurchaseItems(nextRecipe, payload.compras_sugeridas),
      };
      setPayload(nextPayload);
      await savePreparationRecipe(nextPayload);
      setRecipeChangeRequest('');
      setMessage('Receta actualizada con IA.');
    } else {
      setMessage('La IA no devolvió una receta modificada.');
    }

    setAdjustingRecipe(false);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={goBack} style={styles.backButton}>
            <MaterialCommunityIcons name="chevron-left" size={24} color="#064E2F" />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Preparación</Text>
            <Text style={styles.subtitle}>Sigue la receta elegida y decide qué hacer con compras o despensa.</Text>
          </View>
        </View>

        <View
          onLayout={(event) => setBridgeWidth(event.nativeEvent.layout.width)}
          style={styles.topBridge}>
          {bridgeWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.bridgeSlidingPill,
                {
                  width: (bridgeWidth - 12 - 8) / 2,
                  transform: [
                    {
                      translateX: bridgePillAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [6, 6 + (bridgeWidth - 12 - 8) / 2 + 8],
                      }),
                    },
                  ],
                },
              ]}
            />
          )}
          <Pressable accessibilityRole="button" style={styles.bridgeButton}>
            <MaterialCommunityIcons name="chef-hat" size={18} color={bridgeTarget === 'preparacion' ? '#FBFFF8' : '#064E2F'} />
            <Text style={[styles.bridgeButtonText, bridgeTarget === 'preparacion' && styles.bridgeButtonTextActive]}>Preparación</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => switchPreparationSurface('lista')} style={styles.bridgeButton}>
            <MaterialCommunityIcons name="clipboard-list-outline" size={18} color={bridgeTarget === 'lista' ? '#FBFFF8' : '#064E2F'} />
            <Text style={[styles.bridgeButtonText, bridgeTarget === 'lista' && styles.bridgeButtonTextActive]}>Lista de compras</Text>
          </Pressable>
        </View>

        <Animated.View
          style={[
            styles.surfaceContent,
            {
              opacity: surfaceTransition,
              transform: [
                {
                  translateX: surfaceTransition.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-32, 0],
                  }),
                },
                {
                  scale: surfaceTransition.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.97, 1],
                  }),
                },
              ],
            },
          ]}>

        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color="#064E2F" />
          </View>
        ) : !recipe ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="chef-hat" size={42} color="#43A66C" />
            <Text style={styles.emptyText}>Elige una receta y toca Usar para prepararla.</Text>
          </View>
        ) : (
          <>
            <View style={styles.recipeHero}>
              <Text style={styles.recipeTitle}>{recipe.titulo}</Text>
              <Text style={styles.recipeMeta}>
                {[recipe.tiempo_preparacion, recipe.dificultad].filter(Boolean).join(' · ') || payload?.tipo_comida}
              </Text>
            </View>

            {!!recipe.macros_totales && (
              <View style={styles.nutritionPanel}>
                <View style={styles.nutritionHeader}>
                  <View style={styles.nutritionIcon}>
                    <MaterialCommunityIcons name="chart-donut" size={18} color="#064E2F" />
                  </View>
                  <View style={styles.headerCopy}>
                    <Text style={styles.sectionTitle}>Info nutricional</Text>
                    <Text style={styles.nutritionSubtitle}>Totales aproximados de la receta completa.</Text>
                  </View>
                </View>
                <View style={styles.nutritionGrid}>
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>{recipe.macros_totales.calorias ?? 0}</Text>
                    <Text style={styles.nutritionLabel}>kcal</Text>
                  </View>
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>{recipe.macros_totales.proteinas ?? 0}g</Text>
                    <Text style={styles.nutritionLabel}>Proteínas</Text>
                  </View>
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>{recipe.macros_totales.carbohidratos ?? 0}g</Text>
                    <Text style={styles.nutritionLabel}>Carbos</Text>
                  </View>
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>{recipe.macros_totales.grasas ?? 0}g</Text>
                    <Text style={styles.nutritionLabel}>Grasas</Text>
                  </View>
                </View>
              </View>
            )}

            {!!recipe.ingredientes?.length && (
              <View style={styles.ingredientsPanel}>
                <View style={styles.ingredientsHeader}>
                  <View style={styles.ingredientsIcon}>
                    <MaterialCommunityIcons name="food-variant" size={18} color="#064E2F" />
                  </View>
                  <View style={styles.headerCopy}>
                    <Text style={styles.sectionTitle}>Ingredientes usados</Text>
                    <Text style={styles.ingredientsSubtitle}>Lista completa que se toma en cuenta para preparar y descontar despensa.</Text>
                  </View>
                </View>
                <View style={styles.ingredientsList}>
                  {recipe.ingredientes.map((ingredient, ingredientIndex) => (
                    <View key={`${ingredient}-${ingredientIndex}`} style={styles.ingredientRow}>
                      <MaterialCommunityIcons name="check-circle" size={16} color="#00B86B" />
                      <Text style={styles.ingredientText}>{ingredient}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {!!recipe.pasos?.length && (
              <View style={styles.stepsPanel}>
                <Text style={styles.sectionTitle}>Instrucciones</Text>
                {recipe.pasos.map((step, stepIndex) => (
                  <View key={`${step}-${stepIndex}`} style={styles.stepRow}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>{stepIndex + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step.replace(/^\d+\.\s*/, '')}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.actionsPanel}>
              <Pressable
                accessibilityRole="button"
                disabled={deductingPantry}
                onPress={deductRecipeFromPantry}
                style={styles.secondaryButton}>
                {deductingPantry ? (
                  <ActivityIndicator size="small" color="#064E2F" />
                ) : (
                  <MaterialCommunityIcons name="fridge-outline" size={19} color="#064E2F" />
                )}
                <Text style={styles.secondaryButtonText}>Descontar despensa</Text>
              </Pressable>
            </View>

            {activePurchases.length > 0 && (
              <View style={styles.purchasePanel}>
                <View style={styles.purchaseHeader}>
                  <View style={styles.headerCopy}>
                    <Text style={styles.sectionTitle}>Compras para esta receta</Text>
                    <Text style={styles.purchaseSubtitle}>Ingredientes que faltan y pueden ir directo a tu lista.</Text>
                  </View>
                  <Pressable accessibilityRole="button" onPress={() => switchPreparationSurface('lista')} style={styles.purchaseListButton}>
                    <MaterialCommunityIcons name="open-in-new" size={16} color="#064E2F" />
                  </Pressable>
                </View>
                <View style={styles.chipRow}>
                  {activePurchases.map((purchase) => (
                    <Text key={purchase.nombre} style={styles.chip}>
                      {purchase.nombre}
                    </Text>
                  ))}
                </View>
                <View style={styles.purchaseActions}>
                  <Pressable accessibilityRole="button" onPress={addPurchasesToShoppingList} style={styles.primaryButton}>
                    <MaterialCommunityIcons name="cart-plus" size={18} color="#FBFFF8" />
                    <Text style={styles.primaryButtonText}>Agregar faltantes</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => switchPreparationSurface('lista')} style={styles.secondaryButton}>
                    <MaterialCommunityIcons name="clipboard-list-outline" size={18} color="#064E2F" />
                    <Text style={styles.secondaryButtonText}>Ver lista</Text>
                  </Pressable>
                </View>
              </View>
            )}

            <View style={styles.adjustPanel}>
              <View style={styles.adjustHeader}>
                <View style={styles.adjustIcon}>
                  <MaterialCommunityIcons name="creation" size={20} color="#064E2F" />
                </View>
                <View style={styles.headerCopy}>
                  <Text style={styles.adjustTitle}>Cambiar esta receta</Text>
                  <Text style={styles.adjustSubtitle}>Ej: más rápida, sin arroz, más picante o con más proteína.</Text>
                </View>
              </View>
              <TextInput
                multiline
                onChangeText={setRecipeChangeRequest}
                placeholder="¿Qué quieres cambiar?"
                placeholderTextColor="#43A66C"
                style={styles.adjustInput}
                value={recipeChangeRequest}
              />
              <Pressable accessibilityRole="button" disabled={adjustingRecipe} onPress={handleAdjustRecipe} style={styles.primaryButton}>
                {adjustingRecipe ? (
                  <ActivityIndicator size="small" color="#FBFFF8" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="creation" size={18} color="#FBFFF8" />
                    <Text style={styles.primaryButtonText}>Aplicar cambio con IA</Text>
                  </>
                )}
              </Pressable>
            </View>
          </>
        )}

        {!!message && (
          <View style={styles.messageBox}>
            <MaterialCommunityIcons name="information-outline" size={18} color="#064E2F" />
            <Text style={styles.messageText}>{message}</Text>
          </View>
        )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  actionsPanel: {
    gap: 10,
    backgroundColor: 'transparent',
  },
  adjustHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  adjustIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#9FE7B9',
  },
  adjustInput: {
    minHeight: 92,
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
  adjustPanel: {
    gap: 11,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  adjustSubtitle: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  adjustTitle: {
    color: '#064E2F',
    fontSize: 15,
    fontWeight: '900',
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#DDF8E7',
  },
  bridgeButton: {
    minHeight: 44,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  bridgeButtonActive: {
    backgroundColor: '#00B86B',
  },
  bridgeSlidingPill: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    borderRadius: 15,
    backgroundColor: '#00B86B',
    shadowColor: '#00B86B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 2,
  },
  bridgeButtonText: {
    color: '#064E2F',
    fontSize: 13,
    fontWeight: '900',
  },
  bridgeButtonTextActive: {
    color: '#FBFFF8',
  },
  chip: {
    color: '#064E2F',
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#9FE7B9',
    overflow: 'hidden',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    backgroundColor: '#FBFFF8',
  },
  content: {
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 130,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    minHeight: 260,
    padding: 20,
    borderRadius: 22,
    backgroundColor: '#E9FBEF',
  },
  emptyText: {
    color: '#2F7A4F',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  headerCopy: {
    flex: 1,
    gap: 3,
    backgroundColor: 'transparent',
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#DDF8E7',
  },
  ingredientText: {
    flex: 1,
    color: '#0B6B40',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  ingredientsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  ingredientsIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#9FE7B9',
  },
  ingredientsList: {
    gap: 8,
    backgroundColor: 'transparent',
  },
  ingredientsPanel: {
    gap: 12,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  ingredientsSubtitle: {
    color: '#2F7A4F',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  messageBox: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 15,
    backgroundColor: '#D8FBE3',
  },
  messageText: {
    flex: 1,
    color: '#064E2F',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'transparent',
  },
  nutritionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  nutritionIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#BDEFCF',
  },
  nutritionItem: {
    flexBasis: '48%',
    flexGrow: 1,
    gap: 2,
    minHeight: 70,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 15,
    backgroundColor: '#DDF8E7',
  },
  nutritionLabel: {
    color: '#2F7A4F',
    fontSize: 12,
    fontWeight: '800',
  },
  nutritionPanel: {
    gap: 12,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  nutritionSubtitle: {
    color: '#2F7A4F',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  nutritionValue: {
    color: '#064E2F',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
  },
  primaryButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    backgroundColor: '#00B86B',
  },
  primaryButtonText: {
    color: '#FBFFF8',
    fontSize: 14,
    fontWeight: '900',
  },
  purchaseActions: {
    gap: 9,
    backgroundColor: 'transparent',
  },
  purchaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  purchaseListButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#9FE7B9',
  },
  purchasePanel: {
    gap: 12,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  purchaseSubtitle: {
    color: '#2F7A4F',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  recipeHero: {
    gap: 4,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#74D997',
    backgroundColor: '#D8FBE3',
  },
  recipeMeta: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '800',
  },
  recipeTitle: {
    color: '#064E2F',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 27,
  },
  secondaryButton: {
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
  secondaryButtonText: {
    color: '#064E2F',
    fontSize: 14,
    fontWeight: '900',
  },
  sectionTitle: {
    color: '#064E2F',
    fontSize: 16,
    fontWeight: '900',
  },
  stepNumber: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#9FE7B9',
  },
  stepNumberText: {
    color: '#064E2F',
    fontSize: 12,
    fontWeight: '900',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 11,
    borderRadius: 16,
    backgroundColor: '#DDF8E7',
  },
  stepText: {
    flex: 1,
    color: '#0B6B40',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  stepsPanel: {
    gap: 10,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  subtitle: {
    color: '#2F7A4F',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  title: {
    color: '#064E2F',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 32,
  },
  topBridge: {
    flexDirection: 'row',
    gap: 8,
    padding: 6,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
    overflow: 'hidden',
    position: 'relative',
  },
  surfaceContent: {
    gap: 16,
    backgroundColor: 'transparent',
  },
});
