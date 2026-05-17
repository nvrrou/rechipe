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
  pasos?: string[];
}

export interface GenerateRecipeResponse {
  recetas?: GeneratedRecipe[];
  error?: string;
  texto_crudo?: string;
}

export interface GenerateRecipeData {
  user_id: string;
  tipo_comida: string;
  ingredientes: string[];
  objetivo_nutricional?: string;
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
