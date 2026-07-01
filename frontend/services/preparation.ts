import AsyncStorage from '@react-native-async-storage/async-storage';

import { BudgetPurchaseSuggestion, GeneratedRecipe } from './recipes';

export type PreparationPayload = {
  receta: GeneratedRecipe;
  compras_sugeridas: BudgetPurchaseSuggestion[];
  compras_receta: BudgetPurchaseSuggestion[];
  restricciones: string[];
  tipo_comida: string;
  weekly_plan_id?: string;
  weekly_meal_id?: string;
};

const PREPARATION_KEY = 'rechipe:preparation-recipe';

export async function savePreparationRecipe(payload: PreparationPayload) {
  await AsyncStorage.setItem(PREPARATION_KEY, JSON.stringify(payload));
}

export async function getPreparationRecipe(): Promise<PreparationPayload | null> {
  const rawPayload = await AsyncStorage.getItem(PREPARATION_KEY);
  if (!rawPayload) return null;

  try {
    return JSON.parse(rawPayload) as PreparationPayload;
  } catch {
    return null;
  }
}
