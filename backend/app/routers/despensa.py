from fastapi import APIRouter

from app.dependencias import get_supabase_client
from app.models.schemas import DespensaAdd, DespensaUpdate
# IMPORTAMOS NUESTRA IA
from app.services.ai_service import obtener_info_nutricional

router = APIRouter(
    prefix="/despensa",
    tags=["Despensa"]
)

PRODUCT_FIELDS = (
    "id,nombre,codigo_barra,categoria,marca,imagen_url,energia_kcal,"
    "proteinas_g,carbohidratos_g,grasas_g,fibra_g,sodio_mg,azucar_g"
)

DESPENSA_SELECT = (
    "id,cantidad,unidad,precio_aprox,fecha_vencimiento,created_at,producto_id,"
    f"productos_catalogo({PRODUCT_FIELDS})"
)

PRODUCT_ATTRS = [
    "nombre",
    "codigo_barra",
    "categoria",
    "marca",
    "imagen_url",
    "energia_kcal",
    "proteinas_g",
    "carbohidratos_g",
    "grasas_g",
    "fibra_g",
    "sodio_mg",
    "azucar_g",
]

PANTRY_ATTRS = ["cantidad", "unidad", "precio_aprox", "fecha_vencimiento"]


def _clean_payload(payload: dict) -> dict:
    return {key: value for key, value in payload.items() if value is not None}


def _format_item(item: dict) -> dict:
    producto = item.get("productos_catalogo") or {}
    return {
        "id": item["id"],
        "producto_id": item["producto_id"],
        "nombre_producto": producto.get("nombre", "Desconocido"),
        "categoria": producto.get("categoria", "otros"),
        "codigo_barra": producto.get("codigo_barra"),
        "marca": producto.get("marca"),
        "imagen_url": producto.get("imagen_url"),
        "energia_kcal": producto.get("energia_kcal"),
        "proteinas_g": producto.get("proteinas_g"),
        "carbohidratos_g": producto.get("carbohidratos_g"),
        "grasas_g": producto.get("grasas_g"),
        "fibra_g": producto.get("fibra_g"),
        "sodio_mg": producto.get("sodio_mg"),
        "azucar_g": producto.get("azucar_g"),
        "cantidad": item.get("cantidad"),
        "unidad": item.get("unidad"),
        "precio_aprox": item.get("precio_aprox"),
        "fecha_vencimiento": item.get("fecha_vencimiento"),
        "created_at": item.get("created_at"),
    }


async def _get_item(client, item_id: str):
    response = await client.get(
        "/despensa",
        params={"id": f"eq.{item_id}", "select": DESPENSA_SELECT},
    )
    if response.status_code != 200:
        return None, {"error": f"Error al obtener ingrediente. Detalle: {response.text}"}

    items = response.json()
    if not items:
        return None, {"error": "Ingrediente no encontrado"}

    return _format_item(items[0]), None


@router.post("/agregar")
async def agregar_ingrediente(data: DespensaAdd):
    """Agrega un ingrediente a la despensa y guarda sus características de catálogo."""
    try:
        async with get_supabase_client() as client:
            buscar = await client.get(
                "/productos_catalogo",
                params={
                    "nombre": f"ilike.{data.nombre_producto.strip()}",
                    "select": PRODUCT_FIELDS,
                    "limit": "1",
                },
            )

            if buscar.status_code != 200:
                return {"error": f"Error al buscar producto. Detalle: {buscar.text}"}

            productos = buscar.json()

            if productos:
                # SI EL PRODUCTO YA EXISTE, procedemos a actualizar si el usuario envió datos extra
                producto_id = productos[0]["id"]
                product_payload = _clean_payload({
                    "nombre": data.nombre_producto.strip(),
                    "codigo_barra": data.codigo_barra,
                    "categoria": data.categoria,
                    "marca": data.marca,
                    "imagen_url": data.imagen_url,
                    "energia_kcal": data.energia_kcal,
                    "proteinas_g": data.proteinas_g,
                    "carbohidratos_g": data.carbohidratos_g,
                    "grasas_g": data.grasas_g,
                    "fibra_g": data.fibra_g,
                    "sodio_mg": data.sodio_mg,
                    "azucar_g": data.azucar_g,
                })
                
                # Solo hacemos la petición PATCH si hay datos que actualizar
                if product_payload:
                    actualizar_producto = await client.patch(
                        f"/productos_catalogo?id=eq.{producto_id}",
                        json=product_payload,
                    )
                    if actualizar_producto.status_code not in (200, 204):
                        return {"error": f"No se pudo actualizar el producto. Detalle: {actualizar_producto.text}"}
            else:
                # SI EL PRODUCTO NO EXISTE: ¡Magia de la IA!
                print(f"Producto '{data.nombre_producto}' nuevo. Consultando IA para valores nutricionales...")
                resultado_ia = await obtener_info_nutricional(data.nombre_producto)
                
                if "error" in resultado_ia:
                    return {"error": f"Error de la IA al calcular nutrición: {resultado_ia['error']}"}

                # Combinamos lo que haya mandado el usuario con lo que calculó la IA
                # Priorizamos lo del usuario por si lo ingresó manualmente
                product_payload = _clean_payload({
                    "nombre": data.nombre_producto.strip(),
                    "codigo_barra": data.codigo_barra,
                    "categoria": data.categoria,
                    "marca": data.marca,
                    "imagen_url": data.imagen_url,
                    "energia_kcal": data.energia_kcal if data.energia_kcal is not None else resultado_ia.get("energia_kcal"),
                    "proteinas_g": data.proteinas_g if data.proteinas_g is not None else resultado_ia.get("proteinas_g"),
                    "carbohidratos_g": data.carbohidratos_g if data.carbohidratos_g is not None else resultado_ia.get("carbohidratos_g"),
                    # Ojo aquí: Mapeamos 'grasas_totales_g' de la IA a 'grasas_g' de la DB
                    "grasas_g": data.grasas_g if data.grasas_g is not None else resultado_ia.get("grasas_totales_g"),
                    "sodio_mg": data.sodio_mg if data.sodio_mg is not None else resultado_ia.get("sodio_mg"),
                    "fibra_g": data.fibra_g,
                    "azucar_g": data.azucar_g,
                })

                crear_resp = await client.post("/productos_catalogo", json=product_payload)

                if crear_resp.status_code != 201:
                    return {"error": f"No se pudo crear el producto. Detalle: {crear_resp.text}"}

                producto_id = crear_resp.json()[0]["id"]

            # Ahora procedemos a guardar en la despensa del usuario usando el producto_id (ya sea el nuevo o el existente)
            ya_existe = await client.get(
                "/despensa",
                params={
                    "user_id": f"eq.{data.user_id}",
                    "producto_id": f"eq.{producto_id}",
                    "select": "id",
                },
            )

            if ya_existe.status_code != 200:
                return {"error": f"Error al verificar despensa. Detalle: {ya_existe.text}"}

            if ya_existe.json():
                return {"error": "Este ingrediente ya está en tu despensa"}

            item_despensa = _clean_payload({
                "user_id": data.user_id,
                "producto_id": producto_id,
                "cantidad": data.cantidad,
                "unidad": data.unidad,
                "precio_aprox": data.precio_aprox,
                "fecha_vencimiento": data.fecha_vencimiento,
            })
            insertar = await client.post("/despensa", json=item_despensa)

            if insertar.status_code != 201:
                return {"error": f"No se pudo agregar a la despensa. Detalle: {insertar.text}"}

            item_id = insertar.json()[0]["id"]
            item, error = await _get_item(client, item_id)
            return error or item
            
    except Exception as e:
        return {"error": str(e)}


@router.get("/listar/{user_id}")
async def listar_despensa(user_id: str):
    """Obtiene todos los ingredientes de la despensa del usuario con datos del producto."""
    try:
        async with get_supabase_client() as client:
            response = await client.get(
                "/despensa",
                params={"user_id": f"eq.{user_id}", "select": DESPENSA_SELECT},
            )

            if response.status_code != 200:
                return {"error": f"Error al obtener la despensa. Detalle: {response.text}"}

            return {"items": [_format_item(item) for item in response.json()]}
    except Exception as e:
        return {"error": str(e)}


@router.patch("/actualizar/{item_id}")
async def actualizar_ingrediente(item_id: str, data: DespensaUpdate):
    """Actualiza datos de despensa y características del producto asociado."""
    try:
        async with get_supabase_client() as client:
            current_item, error = await _get_item(client, item_id)
            if error:
                return error

            values = data.model_dump(exclude_unset=True)
            product_payload = {}
            for attr in PRODUCT_ATTRS:
                source_key = "nombre_producto" if attr == "nombre" else attr
                if source_key in values:
                    product_payload[attr] = values[source_key]

            pantry_payload = {attr: values[attr] for attr in PANTRY_ATTRS if attr in values}

            if product_payload:
                producto_id = current_item["producto_id"]
                response = await client.patch(
                    f"/productos_catalogo?id=eq.{producto_id}",
                    json=product_payload,
                )
                if response.status_code not in (200, 204):
                    return {"error": f"No se pudo actualizar el producto. Detalle: {response.text}"}

            if pantry_payload:
                response = await client.patch(f"/despensa?id=eq.{item_id}", json=pantry_payload)
                if response.status_code not in (200, 204):
                    return {"error": f"No se pudo actualizar la despensa. Detalle: {response.text}"}

            item, error = await _get_item(client, item_id)
            return error or item
    except Exception as e:
        return {"error": str(e)}


@router.delete("/eliminar/{item_id}")
async def eliminar_ingrediente(item_id: str):
    """Elimina un ingrediente de la despensa."""
    try:
        async with get_supabase_client() as client:
            response = await client.delete(f"/despensa?id=eq.{item_id}")

            if response.status_code not in (200, 204):
                return {"error": f"No se pudo eliminar. Detalle: {response.text}"}

            return {"msg": "Ingrediente eliminado"}
    except Exception as e:
        return {"error": str(e)}


@router.get("/buscar/{user_id}")
async def buscar_ingredientes(user_id: str, q: str = ""):
    """Busca ingredientes en la despensa del usuario por nombre de producto."""
    try:
        async with get_supabase_client() as client:
            response = await client.get(
                "/despensa",
                params={
                    "user_id": f"eq.{user_id}",
                    "select": DESPENSA_SELECT,
                    "productos_catalogo.nombre": f"ilike.*{q}*",
                },
            )

            if response.status_code != 200:
                return {"error": f"Error en la búsqueda. Detalle: {response.text}"}

            items = []
            for item in response.json():
                producto = item.get("productos_catalogo") or {}
                if producto.get("nombre"):
                    items.append(_format_item(item))

            return {"items": items}
    except Exception as e:
        return {"error": str(e)}