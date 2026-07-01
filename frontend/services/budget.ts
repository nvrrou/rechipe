import { API_URL } from './api';
import type { GeneratedRecipe } from './recipes';

export type UserBudget = {
  id: string;
  user_id: string;
  monto: number;
  periodo: string;
  moneda: string;
  gastado: number;
  created_at?: string;
  updated_at?: string;
};

export type WeeklyMeal = {
  id?: string;
  plan_id?: string;
  recipe_id?: string;
  dia_semana?: number;
  tipo: string;
  titulo: string;
  tiempo_preparacion?: string;
  ingredientes?: string[];
  pasos?: string[];
  macros_totales?: {
    calorias?: number;
    proteinas?: number;
    carbohidratos?: number;
    grasas?: number;
  };
  costo_estimado?: number;
  por_que?: string;
};

export type WeeklyPlanDay = {
  dia: string;
  costo_estimado?: number;
  calorias_estimadas?: number;
  proteinas_g?: number;
  carbohidratos_g?: number;
  grasas_g?: number;
  comidas: WeeklyMeal[];
};

export type WeeklyPlan = {
  id?: string;
  nombre?: string;
  semana_inicio?: string;
  presupuesto_id?: string;
  resumen?: string;
  presupuesto_disponible?: number;
  presupuesto_usado?: number;
  dias?: WeeklyPlanDay[];
  compras_sugeridas?: Array<{ nombre: string; cantidad: string; precio: number; motivo?: string }>;
  error?: string;
};

async function parseResponse<T>(res: Response, fallback: string): Promise<T & { error?: string }> {
  const data = await res.json();
  if (!res.ok) return { error: data.detail || data.error || fallback } as T & { error?: string };
  return data;
}

export async function fetchBudget(userId: string): Promise<{ budget?: UserBudget | null; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/budgets/${userId}`);
    return parseResponse(res, 'No se pudo cargar presupuesto');
  } catch (e: any) {
    return { error: `Error de conexion: ${e.message}` };
  }
}

export async function saveBudget(data: { user_id: string; monto: number; periodo: string; moneda?: string }): Promise<{ budget?: UserBudget; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/budgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, moneda: data.moneda || 'CLP' }),
    });
    return parseResponse(res, 'No se pudo guardar presupuesto');
  } catch (e: any) {
    return { error: `Error de conexion: ${e.message}` };
  }
}

export async function spendBudget(data: { user_id: string; monto: number; descripcion?: string }): Promise<{ budget?: UserBudget; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/budgets/spend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseResponse(res, 'No se pudo descontar presupuesto');
  } catch (e: any) {
    return { error: `Error de conexion: ${e.message}` };
  }
}

export async function generateWeeklyPlan(data: {
  user_id: string;
  presupuesto?: number;
  usar_presupuesto_perfil?: boolean;
  preferencias_semana?: string;
  permitir_comidas_intermedias?: boolean;
  dias?: number;
  comidas_por_dia?: number;
}): Promise<WeeklyPlan> {
  try {
    const res = await fetch(`${API_URL}/budgets/weekly-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseResponse(res, 'No se pudo generar plan semanal');
  } catch (e: any) {
    return { error: `Error de conexion: ${e.message}` };
  }
}

export async function fetchLatestWeeklyPlan(userId: string): Promise<{ plan?: WeeklyPlan | null; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/budgets/weekly-plan/latest/${userId}`);
    return parseResponse(res, 'No se pudo cargar plan semanal');
  } catch (e: any) {
    return { error: `Error de conexion: ${e.message}` };
  }
}

export async function updateWeeklyMealRecipe(data: {
  meal_id: string;
  user_id: string;
  receta: GeneratedRecipe;
}): Promise<{ meal?: WeeklyMeal; receta?: GeneratedRecipe; plan?: WeeklyPlan; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/budgets/weekly-plan/meals/${data.meal_id}/recipe`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: data.user_id, receta: data.receta }),
    });
    return parseResponse(res, 'No se pudo actualizar comida semanal');
  } catch (e: any) {
    return { error: `Error de conexion: ${e.message}` };
  }
}
