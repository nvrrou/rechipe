from fastapi import APIRouter
import base64
import httpx
import uuid
from app.dependencias import get_supabase_client
from app.models.schemas import CategoriaProductoCheck, DespensaAdd, DespensaUpdate
from app.routers.supermarkets import guardar_precio_supermercado
from app.services.ai_service import obtener_info_nutricional, generar_url_temporal_dalle, verificar_categoria_producto

router = APIRouter(
    prefix="/despensa",
    tags=["Despensa"]
)

CATALOG_FIELDS = (
    "id,nombre,codigo_barra,categoria,marca,imagen_url,energia_kcal,"
    "proteinas_g,carbohidratos_g,grasas_g,fibra_g,sodio_mg,azucar_g"
)

PRODUCT_FIELDS = (
    "id,user_id,producto_catalogo_id,nombre,codigo_barra,categoria,marca,imagen_url,"
    "energia_kcal,proteinas_g,carbohidratos_g,grasas_totales_g,fibra_g,sodio_mg,"
    "azucares_totales_g,es_personalizado"
)

DESPENSA_SELECT = (
    "id,cantidad,unidad,precio_aprox,fecha_vencimiento,created_at,producto_id"
)

PRODUCT_ATTR_MAP = {
    "nombre_producto": "nombre",
    "codigo_barra": "codigo_barra",
    "categoria": "categoria",
    "marca": "marca",
    "imagen_url": "imagen_url",
    "energia_kcal": "energia_kcal",
    "proteinas_g": "proteinas_g",
    "carbohidratos_g": "carbohidratos_g",
    "grasas_g": "grasas_totales_g",
    "fibra_g": "fibra_g",
    "sodio_mg": "sodio_mg",
    "azucar_g": "azucares_totales_g",
}

PANTRY_ATTRS = ["cantidad", "unidad", "precio_aprox", "fecha_vencimiento"]


def _clean_payload(payload: dict) -> dict:
    return {key: value for key, value in payload.items() if value is not None}


def _first_value(*values):
    for value in values:
        if value is not None and value != "":
            return value
    return None


def _format_item(item: dict, producto: dict | None = None) -> dict:
    producto = producto or {}
    precio_info = item.get("precio_info") or {}
    return {
        "id": item["id"],
        "producto_id": item["producto_id"],
        "producto_catalogo_id": producto.get("producto_catalogo_id"),
        "nombre_producto": producto.get("nombre", "Desconocido"),
        "categoria": producto.get("categoria", "otros"),
        "codigo_barra": producto.get("codigo_barra"),
        "marca": producto.get("marca"),
        "imagen_url": producto.get("imagen_url"),
        "energia_kcal": producto.get("energia_kcal"),
        "proteinas_g": producto.get("proteinas_g"),
        "carbohidratos_g": producto.get("carbohidratos_g"),
        "grasas_g": producto.get("grasas_totales_g"),
        "fibra_g": producto.get("fibra_g"),
        "sodio_mg": producto.get("sodio_mg"),
        "azucar_g": producto.get("azucares_totales_g"),
        "es_personalizado": producto.get("es_personalizado"),
        "cantidad": item.get("cantidad"),
        "unidad": item.get("unidad"),
        "precio_aprox": item.get("precio_aprox"),
        "precio_supermercado": precio_info.get("precio"),
        "precio_unidad": precio_info.get("unidad"),
        "supermercado_id": precio_info.get("supermercado_id"),
        "supermercado_nombre": precio_info.get("supermercado_nombre"),
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

    product, error = await _get_product(client, items[0].get("producto_id"))
    if error:
        return None, error

    price_info, price_error = await _get_price_info(client, items[0].get("producto_id"))
    if price_error:
        return None, price_error

    item = {**items[0], "precio_info": price_info}
    return _format_item(item, product), None


async def _get_product(client, producto_id: str | None):
    if not producto_id:
        return None, {"error": "Ingrediente sin producto asociado"}

    response = await client.get(
        "/productos",
        params={"id": f"eq.{producto_id}", "select": PRODUCT_FIELDS, "limit": "1"},
    )
    if response.status_code != 200:
        return None, {"error": f"Error al obtener producto. Detalle: {response.text}"}

    products = response.json()
    if not products:
        return None, {"error": "Producto asociado no encontrado"}

    return products[0], None


async def _get_products_by_ids(client, product_ids: list[str]):
    clean_ids = [product_id for product_id in product_ids if product_id]
    if not clean_ids:
        return {}, None

    response = await client.get(
        "/productos",
        params={"id": f"in.({','.join(clean_ids)})", "select": PRODUCT_FIELDS},
    )
    if response.status_code != 200:
        return None, {"error": f"Error al obtener productos. Detalle: {response.text}"}

    return {product["id"]: product for product in response.json()}, None


async def _get_price_info(client, producto_id: str | None):
    if not producto_id:
        return {}, None

    response = await client.get(
        "/precios_productos",
        params={
            "producto_id": f"eq.{producto_id}",
            "select": "id,producto_id,supermercado_id,precio,unidad",
            "order": "precio.asc",
            "limit": "1",
        },
    )
    if response.status_code != 200:
        return {}, None

    prices = response.json()
    if not prices:
        return {}, None

    price = prices[0]
    supermarket_name = None
    if price.get("supermercado_id"):
        supermarket_response = await client.get(
            "/supermercados",
            params={"id": f"eq.{price['supermercado_id']}", "select": "nombre", "limit": "1"},
        )
        if supermarket_response.status_code == 200 and supermarket_response.json():
            supermarket_name = supermarket_response.json()[0].get("nombre")

    return {
        "precio": price.get("precio"),
        "supermercado_id": price.get("supermercado_id"),
        "supermercado_nombre": supermarket_name,
        "unidad": price.get("unidad"),
    }, None


async def _get_prices_by_product_ids(client, product_ids: list[str]):
    clean_ids = [product_id for product_id in product_ids if product_id]
    if not clean_ids:
        return {}, None

    response = await client.get(
        "/precios_productos",
        params={
            "producto_id": f"in.({','.join(clean_ids)})",
            "select": "id,producto_id,supermercado_id,precio,unidad",
            "order": "precio.asc",
        },
    )
    if response.status_code != 200:
        return {}, None

    best_by_product = {}
    supermarket_ids = set()
    for price in response.json():
        product_id = price.get("producto_id")
        if product_id and product_id not in best_by_product:
            best_by_product[product_id] = price
            if price.get("supermercado_id"):
                supermarket_ids.add(price["supermercado_id"])

    supermarkets = {}
    if supermarket_ids:
        supermarket_response = await client.get(
            "/supermercados",
            params={"id": f"in.({','.join(supermarket_ids)})", "select": "id,nombre"},
        )
        if supermarket_response.status_code == 200:
            supermarkets = {item["id"]: item.get("nombre") for item in supermarket_response.json()}

    return {
        product_id: {
            "precio": price.get("precio"),
            "unidad": price.get("unidad"),
            "supermercado_id": price.get("supermercado_id"),
            "supermercado_nombre": supermarkets.get(price.get("supermercado_id")),
        }
        for product_id, price in best_by_product.items()
    }, None


async def _find_catalog_product(client, data: DespensaAdd):
    if data.codigo_barra:
        barcode_response = await client.get(
            "/productos_catalogo",
            params={
                "codigo_barra": f"eq.{data.codigo_barra}",
                "select": CATALOG_FIELDS,
                "limit": "1",
            },
        )
        if barcode_response.status_code != 200:
            return None, {"error": f"Error al buscar producto por código. Detalle: {barcode_response.text}"}
        barcode_matches = barcode_response.json()
        if barcode_matches:
            return barcode_matches[0], None

    name_response = await client.get(
        "/productos_catalogo",
        params={
            "nombre": f"ilike.{data.nombre_producto.strip()}",
            "select": CATALOG_FIELDS,
            "limit": "1",
        },
    )
    if name_response.status_code != 200:
        return None, {"error": f"Error al buscar producto. Detalle: {name_response.text}"}

    products = name_response.json()
    return (products[0] if products else None), None


async def _upload_generated_image(client, nombre_producto: str, producto_id: str | None = None):
    resultado_imagen = await generar_url_temporal_dalle(nombre_producto)
    if not resultado_imagen:
        raise Exception("La IA no devolvió ningún dato de imagen.")

    if resultado_imagen.startswith("http"):
        async with httpx.AsyncClient() as dl_client:
            res_img = await dl_client.get(resultado_imagen)
            res_img.raise_for_status()
            bytes_imagen = res_img.content
    else:
        bytes_imagen = base64.b64decode(resultado_imagen)

    supabase_url_base = str(client.base_url).split("/rest/v1")[0]
    suffix = producto_id or uuid.uuid4().hex[:10]
    nombre_archivo = f"prod_{suffix}_{uuid.uuid4().hex[:8]}.png"
    url_storage_upload = f"{supabase_url_base}/storage/v1/object/productos/{nombre_archivo}"
    headers_auth = {k: v for k, v in client.headers.items() if k.lower() in ["authorization", "apikey"]}
    headers_upload = {**headers_auth, "Content-Type": "image/png"}

    async with httpx.AsyncClient() as storage_client:
        res_upload = await storage_client.post(url_storage_upload, headers=headers_upload, content=bytes_imagen)
        if res_upload.status_code not in (200, 201):
            raise Exception(f"Fallo al subir a Storage: {res_upload.text}")

    return f"{supabase_url_base}/storage/v1/object/public/productos/{nombre_archivo}"


async def _build_product_payload(client, data, catalog_product=None, current_product=None):
    values = data.model_dump(exclude_unset=True)
    nombre = values.get("nombre_producto") or (current_product or {}).get("nombre")
    imagen_url = _first_value(values.get("imagen_url"), (catalog_product or {}).get("imagen_url"), (current_product or {}).get("imagen_url"))

    ai_nutrition = {}
    should_generate_nutrition = bool(values.get("generar_info_ia")) and any(
        _first_value(
            values.get(field),
            (catalog_product or {}).get(catalog_field),
            (current_product or {}).get(product_field),
        ) is None
        for field, catalog_field, product_field in [
            ("energia_kcal", "energia_kcal", "energia_kcal"),
            ("proteinas_g", "proteinas_g", "proteinas_g"),
            ("carbohidratos_g", "carbohidratos_g", "carbohidratos_g"),
            ("grasas_g", "grasas_g", "grasas_totales_g"),
            ("sodio_mg", "sodio_mg", "sodio_mg"),
        ]
    )

    if should_generate_nutrition and nombre:
        ai_nutrition = await obtener_info_nutricional(nombre)
        if "error" in ai_nutrition:
            return None, {"error": f"Error de la IA al calcular nutrición: {ai_nutrition['error']}"}

    if values.get("generar_imagen_ia") and not imagen_url and nombre:
        try:
            imagen_url = await _upload_generated_image(client, nombre, (current_product or {}).get("id"))
        except Exception as e_img:
            print(f"Error generando imagen visual, pero el proceso continuará: {e_img}")

    payload = _clean_payload({
        "user_id": values.get("user_id") or (current_product or {}).get("user_id"),
        "producto_catalogo_id": (catalog_product or {}).get("id") or (current_product or {}).get("producto_catalogo_id"),
        "nombre": _first_value(values.get("nombre_producto"), (catalog_product or {}).get("nombre"), (current_product or {}).get("nombre")),
        "codigo_barra": _first_value(values.get("codigo_barra"), (catalog_product or {}).get("codigo_barra"), (current_product or {}).get("codigo_barra")),
        "categoria": _first_value(values.get("categoria"), (catalog_product or {}).get("categoria"), (current_product or {}).get("categoria")),
        "marca": _first_value(values.get("marca"), (catalog_product or {}).get("marca"), (current_product or {}).get("marca")),
        "imagen_url": imagen_url,
        "energia_kcal": _first_value(values.get("energia_kcal"), (catalog_product or {}).get("energia_kcal"), (current_product or {}).get("energia_kcal"), ai_nutrition.get("energia_kcal")),
        "proteinas_g": _first_value(values.get("proteinas_g"), (catalog_product or {}).get("proteinas_g"), (current_product or {}).get("proteinas_g"), ai_nutrition.get("proteinas_g")),
        "carbohidratos_g": _first_value(values.get("carbohidratos_g"), (catalog_product or {}).get("carbohidratos_g"), (current_product or {}).get("carbohidratos_g"), ai_nutrition.get("carbohidratos_g")),
        "grasas_totales_g": _first_value(values.get("grasas_g"), (catalog_product or {}).get("grasas_g"), (current_product or {}).get("grasas_totales_g"), ai_nutrition.get("grasas_totales_g")),
        "fibra_g": _first_value(values.get("fibra_g"), (catalog_product or {}).get("fibra_g"), (current_product or {}).get("fibra_g")),
        "sodio_mg": _first_value(values.get("sodio_mg"), (catalog_product or {}).get("sodio_mg"), (current_product or {}).get("sodio_mg"), ai_nutrition.get("sodio_mg")),
        "azucares_totales_g": _first_value(values.get("azucar_g"), (catalog_product or {}).get("azucar_g"), (current_product or {}).get("azucares_totales_g")),
        "es_personalizado": (catalog_product is None) if current_product is None else current_product.get("es_personalizado"),
    })

    return payload, None


@router.post("/verificar-categoria")
async def verificar_categoria(data: CategoriaProductoCheck):
    """Usa IA para recomendar otra categoria si la actual no calza con el producto."""
    try:
        if not data.nombre_producto.strip() or not data.categoria_actual.strip():
            return {"requiere_cambio": False, "categoria_sugerida": None, "razon": ""}

        resultado = await verificar_categoria_producto(
            data.nombre_producto.strip(),
            data.categoria_actual.strip(),
            data.categorias_disponibles,
        )

        if "error" in resultado:
            return {"requiere_cambio": False, "categoria_sugerida": None, "razon": resultado["error"]}

        return resultado
    except Exception as e:
        return {"requiere_cambio": False, "categoria_sugerida": None, "razon": str(e)}


@router.post("/agregar")
async def agregar_ingrediente(data: DespensaAdd):
    """Agrega un ingrediente a la despensa creando un producto del usuario."""
    try:
        async with get_supabase_client() as client:
            catalog_product, error = await _find_catalog_product(client, data)
            if error:
                return error

            product_payload, error = await _build_product_payload(client, data, catalog_product)
            if error:
                return error

            crear_producto = await client.post("/productos", json=product_payload)
            if crear_producto.status_code != 201:
                return {"error": f"No se pudo crear el producto. Detalle: {crear_producto.text}"}

            producto_id = crear_producto.json()[0]["id"]

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

            price_error = await guardar_precio_supermercado(
                client,
                producto_id,
                data.supermercado_id,
                data.precio_supermercado,
                data.precio_unidad,
                data.user_id,
            )
            if price_error:
                return price_error

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

            pantry_items = response.json()
            products_by_id, error = await _get_products_by_ids(
                client,
                [item.get("producto_id") for item in pantry_items],
            )
            if error:
                return error
            prices_by_id, _ = await _get_prices_by_product_ids(
                client,
                [item.get("producto_id") for item in pantry_items],
            )

            return {
                "items": [
                    _format_item({**item, "precio_info": prices_by_id.get(item.get("producto_id"))}, products_by_id.get(item.get("producto_id")))
                    for item in pantry_items
                ]
            }
    except Exception as e:
        return {"error": str(e)}


@router.patch("/actualizar/{item_id}")
async def actualizar_ingrediente(item_id: str, data: DespensaUpdate):
    """Actualiza datos de despensa y características del producto del usuario."""
    try:
        async with get_supabase_client() as client:
            current_item, error = await _get_item(client, item_id)
            if error:
                return error

            values = data.model_dump(exclude_unset=True)
            product_payload = {}
            for source_key, product_key in PRODUCT_ATTR_MAP.items():
                if source_key in values:
                    product_payload[product_key] = values[source_key]

            if values.get("generar_info_ia") or values.get("generar_imagen_ia"):
                current_product = {
                    "id": current_item["producto_id"],
                    "user_id": None,
                    "producto_catalogo_id": current_item.get("producto_catalogo_id"),
                    "nombre": current_item.get("nombre_producto"),
                    "codigo_barra": current_item.get("codigo_barra"),
                    "categoria": current_item.get("categoria"),
                    "marca": current_item.get("marca"),
                    "imagen_url": current_item.get("imagen_url"),
                    "energia_kcal": current_item.get("energia_kcal"),
                    "proteinas_g": current_item.get("proteinas_g"),
                    "carbohidratos_g": current_item.get("carbohidratos_g"),
                    "grasas_totales_g": current_item.get("grasas_g"),
                    "fibra_g": current_item.get("fibra_g"),
                    "sodio_mg": current_item.get("sodio_mg"),
                    "azucares_totales_g": current_item.get("azucar_g"),
                    "es_personalizado": current_item.get("es_personalizado"),
                }
                ai_payload, error = await _build_product_payload(client, data, None, current_product)
                if error:
                    return error
                product_payload.update({key: value for key, value in ai_payload.items() if key not in ("user_id", "producto_catalogo_id")})

            pantry_payload = {attr: values[attr] for attr in PANTRY_ATTRS if attr in values}

            if product_payload:
                producto_id = current_item["producto_id"]
                response = await client.patch(
                    f"/productos?id=eq.{producto_id}",
                    json=product_payload,
                )
                if response.status_code not in (200, 204):
                    return {"error": f"No se pudo actualizar el producto. Detalle: {response.text}"}

            if pantry_payload:
                response = await client.patch(f"/despensa?id=eq.{item_id}", json=pantry_payload)
                if response.status_code not in (200, 204):
                    return {"error": f"No se pudo actualizar la despensa. Detalle: {response.text}"}

            price_error = await guardar_precio_supermercado(
                client,
                current_item["producto_id"],
                values.get("supermercado_id"),
                values.get("precio_supermercado"),
                values.get("precio_unidad"),
            )
            if price_error:
                return price_error

            item, error = await _get_item(client, item_id)
            return error or item
    except Exception as e:
        return {"error": str(e)}


@router.post("/autenticar/{producto_id}")
async def solicitar_autenticacion_producto(producto_id: str, user_id: str):
    """Solicita revisión admin para autenticar un producto creado por el usuario."""
    try:
        async with get_supabase_client() as client:
            producto = await client.get(
                "/productos",
                params={"id": f"eq.{producto_id}", "user_id": f"eq.{user_id}", "select": "id"},
            )
            if producto.status_code != 200:
                return {"error": f"Error al validar producto. Detalle: {producto.text}"}
            if not producto.json():
                return {"error": "Producto no encontrado para este usuario"}

            existente = await client.get(
                "/productos_auth",
                params={
                    "producto_id": f"eq.{producto_id}",
                    "solicitado_por": f"eq.{user_id}",
                    "estado": "eq.pendiente",
                    "select": "id,estado",
                    "limit": "1",
                },
            )
            if existente.status_code != 200:
                return {"error": f"Error al revisar solicitud. Detalle: {existente.text}"}
            if existente.json():
                return {"msg": "Este producto ya tiene una solicitud pendiente", "solicitud": existente.json()[0]}

            response = await client.post(
                "/productos_auth",
                json={"producto_id": producto_id, "solicitado_por": user_id},
            )
            if response.status_code != 201:
                return {"error": f"No se pudo solicitar autenticación. Detalle: {response.text}"}

            return {"msg": "Solicitud enviada", "solicitud": response.json()[0]}
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
            pantry_response = await client.get(
                "/despensa",
                params={
                    "user_id": f"eq.{user_id}",
                    "select": DESPENSA_SELECT,
                },
            )

            if pantry_response.status_code != 200:
                return {"error": f"Error en la búsqueda. Detalle: {pantry_response.text}"}

            pantry_items = pantry_response.json()
            products_by_id, error = await _get_products_by_ids(
                client,
                [item.get("producto_id") for item in pantry_items],
            )
            if error:
                return error
            prices_by_id, _ = await _get_prices_by_product_ids(
                client,
                [item.get("producto_id") for item in pantry_items],
            )

            items = []
            normalized_query = q.strip().lower()
            for item in pantry_items:
                producto = products_by_id.get(item.get("producto_id")) or {}
                if normalized_query in (producto.get("nombre") or "").lower():
                    items.append(_format_item({**item, "precio_info": prices_by_id.get(item.get("producto_id"))}, producto))

            return {"items": items}
    except Exception as e:
        return {"error": str(e)}
