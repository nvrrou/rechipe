import { API_URL } from './api';
import { BudgetPurchaseSuggestion, GeneratedRecipe } from './recipes';

export type GroupRole = 'admin' | 'editor' | 'espectador';

export interface SocialGroup {
  id: string;
  nombre: string;
  creado_por?: string;
  codigo_grupo?: string;
  mi_rol?: GroupRole;
  accepted?: boolean;
  created_at?: string;
}

export interface GroupMember {
  grupo_id: string;
  user_id: string;
  rol: GroupRole;
  accepted: boolean;
  joined_at?: string;
  nombre: string;
  email?: string;
  objetivos: string[];
  restricciones: string[];
  ingredientes_favoritos: string[];
}

export interface GroupDetailResponse {
  grupo?: SocialGroup;
  miembro?: GroupMember;
  miembros?: GroupMember[];
  mi_rol?: GroupRole;
  error?: string;
}

export interface GroupsResponse {
  items?: SocialGroup[];
  error?: string;
}

export interface GroupRecipeData {
  user_id: string;
  tipo_comida: string;
  ingredientes: string[];
  objetivo_nutricional?: string;
  restricciones?: string[];
  usar_restricciones_perfil?: boolean;
  presupuestada?: boolean;
  presupuesto?: number;
}

export interface GroupRecipeResponse {
  grupo_id?: string;
  recetas?: GeneratedRecipe[];
  compras_sugeridas?: BudgetPurchaseSuggestion[];
  costo_total?: number;
  error?: string;
  texto_crudo?: string;
}

export interface GroupRecipeHistoryResponse {
  items?: GeneratedRecipe[];
  error?: string;
}

async function parseResponse<T>(res: Response, fallbackError: string): Promise<T & { error?: string }> {
  const data = await res.json();
  if (!res.ok) {
    return { error: data.detail || data.error || fallbackError } as T & { error?: string };
  }
  if (typeof data === 'string') {
    return { error: data } as T & { error?: string };
  }
  return data;
}

export async function fetchGroups(userId: string): Promise<GroupsResponse> {
  try {
    const res = await fetch(`${API_URL}/social/grupos/${userId}`);
    return parseResponse<GroupsResponse>(res, 'No se pudieron cargar los grupos');
  } catch (e: any) {
    return { error: `Error de conexion: ${e.message}` };
  }
}

export async function createGroup(userId: string, nombre: string): Promise<GroupDetailResponse> {
  try {
    const res = await fetch(`${API_URL}/social/grupos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, nombre }),
    });
    return parseResponse<GroupDetailResponse>(res, 'No se pudo crear el grupo');
  } catch (e: any) {
    return { error: `Error de conexion: ${e.message}` };
  }
}

export async function joinGroup(userId: string, codigoGrupo: string): Promise<GroupDetailResponse> {
  try {
    const res = await fetch(`${API_URL}/social/grupos/unirse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, codigo_grupo: codigoGrupo }),
    });
    return parseResponse<GroupDetailResponse>(res, 'No se pudo unir al grupo');
  } catch (e: any) {
    return { error: `Error de conexion: ${e.message}` };
  }
}

export async function fetchGroupDetail(groupId: string, userId: string): Promise<GroupDetailResponse> {
  try {
    const res = await fetch(`${API_URL}/social/grupos/${groupId}/detalle?user_id=${encodeURIComponent(userId)}`);
    return parseResponse<GroupDetailResponse>(res, 'No se pudo cargar el grupo');
  } catch (e: any) {
    return { error: `Error de conexion: ${e.message}` };
  }
}

export async function updateGroupMemberRole(
  groupId: string,
  memberUserId: string,
  actorUserId: string,
  rol: GroupRole
): Promise<{ ok?: boolean; rol?: GroupRole; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/social/grupos/${groupId}/miembros/${memberUserId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor_user_id: actorUserId, rol }),
    });
    return parseResponse<{ ok?: boolean; rol?: GroupRole }>(res, 'No se pudo cambiar el rol');
  } catch (e: any) {
    return { error: `Error de conexion: ${e.message}` };
  }
}

export async function updateGroupMemberAccepted(
  groupId: string,
  memberUserId: string,
  actorUserId: string,
  accepted: boolean
): Promise<{ ok?: boolean; accepted?: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/social/grupos/${groupId}/miembros/${memberUserId}/accepted`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor_user_id: actorUserId, accepted }),
    });
    return parseResponse<{ ok?: boolean; accepted?: boolean }>(res, 'No se pudo revisar la solicitud');
  } catch (e: any) {
    return { error: `Error de conexion: ${e.message}` };
  }
}

export async function kickGroupMember(
  groupId: string,
  memberUserId: string,
  actorUserId: string
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${API_URL}/social/grupos/${groupId}/miembros/${memberUserId}?actor_user_id=${encodeURIComponent(actorUserId)}`,
      { method: 'DELETE' }
    );
    return parseResponse<{ ok?: boolean }>(res, 'No se pudo expulsar al miembro');
  } catch (e: any) {
    return { error: `Error de conexion: ${e.message}` };
  }
}

export async function generateGroupRecipes(
  groupId: string,
  data: GroupRecipeData
): Promise<GroupRecipeResponse> {
  try {
    const res = await fetch(`${API_URL}/social/grupos/${groupId}/recetas/generar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseResponse<GroupRecipeResponse>(res, 'No se pudo generar el pack');
  } catch (e: any) {
    return { error: `Error de conexion: ${e.message}` };
  }
}

export async function generateBudgetGroupRecipes(
  groupId: string,
  data: GroupRecipeData
): Promise<GroupRecipeResponse> {
  try {
    const res = await fetch(`${API_URL}/social/grupos/${groupId}/recetas/generar-presupuestada`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, presupuestada: true }),
    });
    return parseResponse<GroupRecipeResponse>(res, 'No se pudo generar el pack presupuestado');
  } catch (e: any) {
    return { error: `Error de conexion: ${e.message}` };
  }
}

export async function fetchGroupRecipeHistory(
  groupId: string,
  userId: string
): Promise<GroupRecipeHistoryResponse> {
  try {
    const res = await fetch(`${API_URL}/social/grupos/${groupId}/recetas?user_id=${encodeURIComponent(userId)}`);
    return parseResponse<GroupRecipeHistoryResponse>(res, 'No se pudo cargar el historial grupal');
  } catch (e: any) {
    return { error: `Error de conexion: ${e.message}` };
  }
}
