import { API_URL } from './api';

export interface GeneratedRecipe {
  titulo: string;
  tiempo_preparacion?: string;
  dificultad?: string;
  por_que_funciona?: string | null;
  macros_totales?: {
    calorias?: number;
    proteinas?: number;
    carbohidratos?: number;
    grasas?: number;
  };
  ingredientes?: string[];
  compras_usadas?: string[];
  pasos?: string[];
}

export interface GenerateRecipeResponse {
  recetas?: GeneratedRecipe[];
  compras_sugeridas?: BudgetPurchaseSuggestion[];
  costo_total?: number;
  error?: string;
  texto_crudo?: string;
}

export interface GenerateRecipeData {
  user_id: string;
  tipo_comida: string;
  ingredientes: string[];
  objetivo_nutricional?: string;
  restricciones?: string[];
  usar_restricciones_perfil?: boolean;
}

export interface BudgetPurchaseSuggestion {
  nombre: string;
  categoria: string;
  cantidad: string;
  precio: number;
  reason?: string;
}

export interface GenerateBudgetRecipeData {
  user_id: string;
  tipo_comida: string;
  presupuesto: number;
  ingredientes?: string[];
  objetivo_nutricional?: string;
  restricciones?: string[];
  usar_restricciones_perfil?: boolean;
}

export interface AdjustRecipeData {
  receta: GeneratedRecipe;
  cambios: string;
  restricciones?: string[];
  compras_sugeridas?: BudgetPurchaseSuggestion[];
}

export async function generateRecipes(data: GenerateRecipeData): Promise<GenerateRecipeResponse> {
  try {
    const res = await fetch(`${API_URL}/recipes/generar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const responseData = await res.json();

    if (typeof responseData === 'string') {
      return { error: responseData };
    }

    return responseData;
  } catch (e: any) {
    return { error: `Error de conexión: ${e.message}` };
  }
}

export async function adjustRecipe(data: AdjustRecipeData): Promise<GenerateRecipeResponse> {
  try {
    const res = await fetch(`${API_URL}/recipes/modificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const responseData = await res.json();

    if (typeof responseData === 'string') {
      return { error: responseData };
    }

    if (!res.ok) {
      return { error: responseData.detail || responseData.error || 'No se pudo modificar la receta' };
    }

    return responseData;
  } catch (e: any) {
    return { error: `Error de conexión: ${e.message}` };
  }
}

export async function generateBudgetRecipe(data: GenerateBudgetRecipeData): Promise<GenerateRecipeResponse> {
  try {
    const res = await fetch(`${API_URL}/recipes/generar-presupuestada`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const responseData = await res.json();

    if (typeof responseData === 'string') {
      return { error: responseData };
    }

    if (!res.ok) {
      return { error: responseData.detail || responseData.error || 'No se pudo generar receta presupuestada' };
    }

    return responseData;
  } catch (e: any) {
    return { error: `Error de conexión: ${e.message}` };
  }
}
