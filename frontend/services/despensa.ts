// Servicio API para la despensa (HU-01)
import { API_URL } from './api';

// ---------- Tipos ----------

export interface DespensaAddData {
  user_id: string;
  producto_catalogo_id?: string;
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
  cantidad_precio?: number;
  unidad_precio?: string;
  supermercado_id?: string;
  precio_supermercado?: number;
  precio_unidad?: string;
  fecha_vencimiento?: string;
  generar_info_ia?: boolean;
  generar_imagen_ia?: boolean;
}

export interface DespensaBarcodeAddData {
  user_id: string;
  codigo_barra: string;
  categorias_disponibles?: string[];
  usar_ia?: boolean;
  cantidad?: number;
  unidad?: string;
  precio_aprox?: number;
  cantidad_precio?: number;
  unidad_precio?: string;
  supermercado_id?: string;
  precio_supermercado?: number;
  precio_unidad?: string;
  fecha_vencimiento?: string;
  generar_imagen_ia?: boolean;
}

export interface DespensaUpdateData {
  producto_catalogo_id?: string;
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
  cantidad_precio?: number;
  unidad_precio?: string;
  supermercado_id?: string;
  precio_supermercado?: number;
  precio_unidad?: string;
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
  cantidad_precio?: number;
  unidad_precio?: string;
  precio_supermercado?: number;
  supermercado_id?: string;
  precio_unidad?: string;
  supermercado_nombre?: string;
  fecha_vencimiento?: string;
  created_at?: string;
  producto_catalogo_id?: string;
  es_personalizado?: boolean;
  origen_agregado?: 'bdd' | 'ia';
  mensaje_agregado?: string;
  tipo?: string;
  requiere_ia?: boolean;
  mensaje?: string;
}

export interface CategoriaCheckResult {
  requiere_cambio?: boolean;
  categoria_sugerida?: string | null;
  razon?: string;
  error?: string;
}

export interface SupermarketData {
  id: string;
  nombre: string;
  cadena?: string;
  direccion?: string;
}

export interface CatalogProductData {
  id: string;
  nombre_producto: string;
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
}

export interface PriceByCatalogData {
  producto_catalogo_id: string;
  precio?: number | null;
  unidad?: string | null;
  supermercado_id?: string | null;
  supermercado_nombre?: string | null;
  error?: string;
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

/** Agrega un ingrediente usando solo el codigo de barra */
export async function agregarIngredientePorCodigo(data: DespensaBarcodeAddData): Promise<DespensaItemData & { error?: string }> {
  try {
    const res = await fetch(`${API_URL}/despensa/agregar-por-codigo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const responseData = await res.json();
    if (!res.ok) {
      return { error: responseData.detail || responseData.error || 'No se pudo agregar el ingrediente por codigo' } as any;
    }
    return responseData;
  } catch (e: any) {
    return { error: `Error de conexión: ${e.message}` } as any;
  }
}

export async function fetchSupermarkets(): Promise<{ items?: SupermarketData[]; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/supermarkets/listar`);
    const data = await res.json();
    return data;
  } catch (e: any) {
    return { error: `Error de conexión: ${e.message}` };
  }
}

/** Obtiene el mejor precio guardado en precios_productos usando producto_catalogo_id */
export async function fetchPrecioPorCatalogo(productoCatalogoId: string): Promise<PriceByCatalogData> {
  try {
    const res = await fetch(`${API_URL}/despensa/precio-por-catalogo/${encodeURIComponent(productoCatalogoId)}`);
    const data = await res.json();
    return data;
  } catch (e: any) {
    return { producto_catalogo_id: productoCatalogoId, error: `Error de conexiÃ³n: ${e.message}` };
  }
}

/** Recomienda productos del catálogo base por nombre o código de barra */
export async function fetchCatalogProductSuggestions(data: {
  nombre_producto?: string;
  codigo_barra?: string;
  categoria_actual?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items?: CatalogProductData[]; has_more?: boolean; error?: string }> {
  try {
    const params = new URLSearchParams();
    if (data.nombre_producto) params.set('nombre_producto', data.nombre_producto);
    if (data.codigo_barra) params.set('codigo_barra', data.codigo_barra);
    if (data.categoria_actual) params.set('categoria_actual', data.categoria_actual);
    if (data.limit !== undefined) params.set('limit', String(data.limit));
    if (data.offset !== undefined) params.set('offset', String(data.offset));
    const res = await fetch(`${API_URL}/despensa/catalogo/recomendaciones?${params.toString()}`);
    const responseData = await res.json();
    return responseData;
  } catch (e: any) {
    return { error: `Error de conexión: ${e.message}` };
  }
}

/** Verifica si la categoria elegida calza con el producto */
export async function verificarCategoriaProducto(data: {
  nombre_producto: string;
  categoria_actual: string;
  categorias_disponibles: string[];
}): Promise<CategoriaCheckResult> {
  try {
    const res = await fetch(`${API_URL}/despensa/verificar-categoria`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const responseData = await res.json();
    return responseData;
  } catch (e: any) {
    return { error: `Error de conexión: ${e.message}` };
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
