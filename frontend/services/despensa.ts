// Servicio API para la despensa (HU-01)
import { API_URL } from './api';

// ---------- Tipos ----------

export interface DespensaAddData {
  user_id: string;
  nombre_producto: string;
  categoria: string;
  cantidad?: number;
  unidad?: string;
}

export interface DespensaItemData {
  id: string;
  producto_id: string;
  nombre_producto: string;
  categoria: string;
  cantidad?: number;
  unidad?: string;
  created_at?: string;
}

// ---------- Funciones ----------

/** Obtiene todos los ingredientes de la despensa del usuario */
export async function fetchDespensa(userId: string): Promise<{ items?: DespensaItemData[]; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/despensa/listar/${userId}`);
    const data = await res.json();
    return data;
  } catch (e: any) {
    return { error: `Error de conexión: ${e.message}` };
  }
}

/** Agrega un ingrediente a la despensa */
export async function agregarIngrediente(data: DespensaAddData): Promise<DespensaItemData & { error?: string }> {
  try {
    const res = await fetch(`${API_URL}/despensa/agregar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const responseData = await res.json();
    return responseData;
  } catch (e: any) {
    return { error: `Error de conexión: ${e.message}` } as any;
  }
}

/** Elimina un ingrediente de la despensa */
export async function eliminarIngrediente(itemId: string): Promise<{ msg?: string; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/despensa/eliminar/${itemId}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    return data;
  } catch (e: any) {
    return { error: `Error de conexión: ${e.message}` };
  }
}

/** Busca ingredientes en la despensa del usuario por nombre */
export async function buscarIngredientes(userId: string, query: string): Promise<{ items?: DespensaItemData[]; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/despensa/buscar/${userId}?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    return data;
  } catch (e: any) {
    return { error: `Error de conexión: ${e.message}` };
  }
}
