// Servicio API para la despensa (HU-01)
import { API_URL } from './api';

// ---------- Tipos ----------

export interface DespensaAddData {
  user_id: string;
  nombre_producto: string;
  categoria: string;
  codigo_barra?: string;
  marca?: string;
  imagen_url?: string;
  energia_kcal?: number;
  proteinas_g?: number;
  carbohidratos_g?: number;
  grasas_g?: number;
  fibra_g?: number;
  sodio_mg?: number;
  azucar_g?: number;
  cantidad?: number;
  unidad?: string;
  precio_aprox?: number;
  fecha_vencimiento?: string;
  generar_info_ia?: boolean;
  generar_imagen_ia?: boolean;
}

export interface DespensaUpdateData {
  nombre_producto?: string;
  categoria?: string;
  codigo_barra?: string;
  marca?: string;
  imagen_url?: string;
  energia_kcal?: number;
  proteinas_g?: number;
  carbohidratos_g?: number;
  grasas_g?: number;
  fibra_g?: number;
  sodio_mg?: number;
  azucar_g?: number;
  cantidad?: number;
  unidad?: string;
  precio_aprox?: number;
  fecha_vencimiento?: string;
  generar_info_ia?: boolean;
  generar_imagen_ia?: boolean;
}

export interface DespensaItemData {
  id: string;
  producto_id: string;
  nombre_producto: string;
  categoria: string;
  codigo_barra?: string;
  marca?: string;
  imagen_url?: string;
  energia_kcal?: number;
  proteinas_g?: number;
  carbohidratos_g?: number;
  grasas_g?: number;
  fibra_g?: number;
  sodio_mg?: number;
  azucar_g?: number;
  cantidad?: number;
  unidad?: string;
  precio_aprox?: number;
  fecha_vencimiento?: string;
  created_at?: string;
  producto_catalogo_id?: string;
  es_personalizado?: boolean;
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
    if (!res.ok) {
      return { error: responseData.detail || responseData.error || 'No se pudo agregar el ingrediente' } as any;
    }
    return responseData;
  } catch (e: any) {
    return { error: `Error de conexión: ${e.message}` } as any;
  }
}

/** Actualiza un ingrediente y sus características */
export async function actualizarIngrediente(
  itemId: string,
  data: DespensaUpdateData
): Promise<DespensaItemData & { error?: string }> {
  try {
    const res = await fetch(`${API_URL}/despensa/actualizar/${itemId}`, {
      method: 'PATCH',
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

/** Solicita revisión admin para autenticar un producto */
export async function solicitarAutenticacionProducto(
  productoId: string,
  userId: string
): Promise<{ msg?: string; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/despensa/autenticar/${productoId}?user_id=${encodeURIComponent(userId)}`, {
      method: 'POST',
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
