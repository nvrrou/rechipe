from fastapi import APIRouter, HTTPException, Depends
from app.models.schemas import BudgetRecipeRequest, RecipeAdjustRequest, RecipeRequest, EsquemaAlimento
from app.services.ai_service import (
    estimar_precio_producto_chile,
    generar_receta_con_ia,
    generar_receta_presupuestada_con_ia,
    modificar_receta_con_ia,
    obtener_info_nutricional,
    generar_url_temporal_dalle,
)
from app.dependencias import get_supabase_client
import httpx
import uuid


router = APIRouter(
    prefix="/recipes",
    tags=["Recetas"]
)

PRODUCT_SELECT = "id,nombre,categoria,energia_kcal,proteinas_g,carbohidratos_g,grasas_totales_g"


async def _get_profile_context(client: httpx.AsyncClient, user_id: str):
    profile_response = await client.get(
        "/profiles",
        params={"id": f"eq.{user_id}", "select": "objetivos,restricciones", "limit": "1"},
    )
    profile_response.raise_for_status()
    profile_data = profile_response.json()

    if not profile_data:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    profile = profile_data[0]
    objetivos = profile.get("objetivos") or []
    restricciones = profile.get("restricciones") or []

    return {
        "objetivos": objetivos if isinstance(objetivos, list) else [str(objetivos)],
        "restricciones": restricciones if isinstance(restricciones, list) else [str(restricciones)],
    }


def _merge_unique_text(values: list[str]):
    seen = set()
    merged = []
    for value in values:
        clean_value = str(value or "").strip()
        key = clean_value.lower()
        if clean_value and key not in seen:
            seen.add(key)
            merged.append(clean_value)
    return merged


async def _get_user_pantry(client: httpx.AsyncClient, user_id: str):
    pantry_response = await client.get(
        "/despensa",
        params={"user_id": f"eq.{user_id}", "select": "cantidad,unidad,producto_id"},
    )
    pantry_response.raise_for_status()
    pantry_items = pantry_response.json()
    product_ids = [item.get("producto_id") for item in pantry_items if item.get("producto_id")]

    if not product_ids:
        return []

    products_response = await client.get(
        "/productos",
        params={"id": f"in.({','.join(product_ids)})", "select": PRODUCT_SELECT},
    )
    products_response.raise_for_status()
    products_by_id = {product["id"]: product for product in products_response.json()}

    return [
        {**item, "producto": products_by_id.get(item.get("producto_id"))}
        for item in pantry_items
        if products_by_id.get(item.get("producto_id"))
    ]


async def _get_best_price(client: httpx.AsyncClient, producto_id: str):
    price_response = await client.get(
        "/precios_productos",
        params={
            "producto_id": f"eq.{producto_id}",
            "select": "precio,unidad,supermercado_id",
            "order": "precio.asc",
            "limit": "1",
        },
    )
    if price_response.status_code != 200 or not price_response.json():
        return None

    price = price_response.json()[0]
    supermercado_nombre = None
    if price.get("supermercado_id"):
        supermarket_response = await client.get(
            "/supermercados",
            params={"id": f"eq.{price['supermercado_id']}", "select": "nombre", "limit": "1"},
        )
        if supermarket_response.status_code == 200 and supermarket_response.json():
            supermercado_nombre = supermarket_response.json()[0].get("nombre")

    return {
        "precio": price.get("precio"),
        "unidad": price.get("unidad"),
        "supermercado_nombre": supermercado_nombre,
    }


async def _find_purchase_candidates(client: httpx.AsyncClient, pantry_names: set[str], limit: int = 8):
    products_response = await client.get(
        "/productos",
        params={"select": PRODUCT_SELECT, "limit": "80"},
    )
    products_response.raise_for_status()

    candidates = []
    for product in products_response.json():
        name = (product.get("nombre") or "").lower()
        if not name or name in pantry_names:
            continue

        price = await _get_best_price(client, product["id"])
        if not price:
            continue

        candidates.append({
            "nombre": product.get("nombre"),
            "categoria": product.get("categoria") or "Otros",
            "cantidad": price.get("unidad") or "1 unidad",
            "precio": price.get("precio"),
            "reason": f"Precio encontrado en {price.get('supermercado_nombre') or 'supermercado'}",
        })

        if len(candidates) >= limit:
            break

    return candidates


async def _build_estimated_candidates(existing_names: set[str], needed_count: int = 6):
    fallback_products = [
        ("Huevos", "Proteínas"),
        ("Avena", "Cereales"),
        ("Lentejas", "Legumbres"),
        ("Atún", "Proteínas"),
        ("Verduras surtidas", "Vegetales"),
        ("Yogurt natural", "Lácteos"),
        ("Pechuga de pollo", "Carnes"),
        ("Arroz", "Cereales"),
    ]

    candidates = []
    for name, category in fallback_products:
        if name.lower() in existing_names:
            continue
        estimate = await estimar_precio_producto_chile(name, category)
        if "error" in estimate:
            continue
        candidates.append({
            "nombre": estimate.get("nombre") or name,
            "categoria": estimate.get("categoria") or category,
            "cantidad": estimate.get("cantidad") or "1 unidad",
            "precio": estimate.get("precio") or 0,
            "reason": estimate.get("razon") or "Precio estimado para Chile",
        })
        if len(candidates) >= needed_count:
            break
    return candidates

@router.post("/analizar-alimento")
async def analizar_alimento(
    datos: EsquemaAlimento,
    # Inyectamos el cliente de Supabase configurado por tu equipo
    client: httpx.AsyncClient = Depends(get_supabase_client)
):
    # Estandarizamos el nombre a minúsculas y limpiamos espacios vacíos
    nombre_buscado = datos.nombre.strip().lower()
    
    try:
        # 1. Buscar si el producto ya está en el catálogo de Supabase
        # Usamos PostgREST: ?nombre=ilike.nombre_buscado (ignora mayúsculas/minúsculas)
        url_busqueda = f"/productos_catalogo?nombre=ilike.{nombre_buscado}"
        respuesta_busqueda = await client.get(url_busqueda)
        respuesta_busqueda.raise_for_status()
        
        datos_existentes = respuesta_busqueda.json()
        
        # Si la lista contiene datos, el producto ya existe y lo retornamos inmediatamente
        if datos_existentes:
            print("Alimento encontrado en base de datos. Evitando llamada a IA.")
            return datos_existentes[0]
            
        # 2. Si no existe, llamamos a la IA experta en nutrición
        resultado_ia = await obtener_info_nutricional(datos.nombre)
        
        if "error" in resultado_ia:
            raise HTTPException(status_code=500, detail=resultado_ia["error"])
            
        # 3. Devolvemos el análisis sin escribir en productos_catalogo.
        return {
            "nombre": datos.nombre.strip(),
            "energia_kcal": resultado_ia.get("energia_kcal", 0),
            "proteinas_g": resultado_ia.get("proteinas_g", 0),
            "carbohidratos_g": resultado_ia.get("carbohidratos_g", 0),
            "grasas_g": resultado_ia.get("grasas_totales_g", 0),
            "sodio_mg": resultado_ia.get("sodio_mg", 0)
        }

    except httpx.HTTPStatusError as exc:
        # Captura errores de respuesta de la API de Supabase (ej. violación de restricciones en la BD)
        raise HTTPException(
            status_code=exc.response.status_code, 
            detail=f"Error en Supabase: {exc.response.text}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en el servidor: {str(e)}")


@router.post("/asignar-imagen/{producto_id}")
async def asignar_imagen_permanente(
    producto_id: str,
    client: httpx.AsyncClient = Depends(get_supabase_client)
):
    """
    Genera una imagen con IA para un producto específico, la aloja permanentemente
    en Supabase Storage y actualiza la imagen del producto del usuario.
    """
    try:
        # 1. Obtener el nombre del producto desde la tabla 'productos'
        url_get_prod = f"/productos?id=eq.{producto_id}&select=nombre"
        res_prod = await client.get(url_get_prod)
        res_prod.raise_for_status()
        prod_data = res_prod.json()

        if not prod_data:
            raise HTTPException(status_code=404, detail="El producto no existe")
        
        nombre_producto = prod_data[0]["nombre"]

        # 2. IA: Generar la URL temporal usando DALL-E 3
        url_temporal_openai = await generar_url_temporal_dalle(nombre_producto)

        # 3. DESCARGAR: Bajamos los bytes de la imagen temporal utilizando una petición limpia
        async with httpx.AsyncClient() as download_client:
            res_imagen_bytes = await download_client.get(url_temporal_openai)
            if res_imagen_bytes.status_code != 200:
                raise HTTPException(status_code=500, detail="No se pudo descargar la imagen desde OpenAI")
            bytes_imagen = res_imagen_bytes.content

        # --- MANEJO DE URL PARA STORAGE ---
        # Extraemos el dominio base (ej. 'https://xyz.supabase.co') del cliente preconfigurado
        supabase_url_base = str(client.base_url).split("/rest/v1")[0]

        # 4. SUBIR A SUPABASE STORAGE: Le asignamos un nombre único al archivo (.png)
        nombre_archivo = f"prod_{producto_id}_{uuid.uuid4().hex[:8]}.png"
        url_storage_upload = f"{supabase_url_base}/storage/v1/object/productos/{nombre_archivo}"
        
        # Copiamos las cabeceras de autenticación que tu cliente ya tiene (Authorization y apikey)
        headers_auth = {k: v for k, v in client.headers.items() if k.lower() in ["authorization", "apikey"]}
        headers_upload = {**headers_auth, "Content-Type": "image/png"}

        async with httpx.AsyncClient() as storage_client:
            res_upload = await storage_client.post(url_storage_upload, headers=headers_upload, content=bytes_imagen)
            res_upload.raise_for_status()

        # 5. URL PERMANENTE: Construimos el enlace público definitivo de tu bucket
        url_publica_permanente = f"{supabase_url_base}/storage/v1/object/public/productos/{nombre_archivo}"

        # 6. GUARDAR EN BD: Actualizamos la imagen del producto del usuario
        url_update_prod = f"/productos?id=eq.{producto_id}"
        res_update = await client.patch(url_update_prod, json={"imagen_url": url_publica_permanente})
        res_update.raise_for_status()

        return {
            "status": "success",
            "mensaje": f"Imagen asignada con éxito a {nombre_producto}",
            "url_permanente": url_publica_permanente
        }

    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code, 
            detail=f"Error en comunicación de Supabase: {exc.response.text}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


@router.post("/generar")
async def generar_receta(
    request: RecipeRequest,
    client: httpx.AsyncClient = Depends(get_supabase_client)
):
    try:
        # 1. Obtener objetivos y restricciones del usuario desde profiles.
        profile_context = await _get_profile_context(client, request.user_id)
        objetivos_perfil = profile_context["objetivos"]
        objetivo_base = ", ".join(objetivos_perfil)
        restricciones_alimentarias = _merge_unique_text([
            *(profile_context["restricciones"] if request.usar_restricciones_perfil else []),
            *(request.restricciones or []),
        ])

        # LA MAGIA DE LOS OBJETIVOS COMBINADOS
        # Juntamos la meta a largo plazo con el antojo o necesidad actual
        objetivos_combinados = ""
        
        if objetivo_base and objetivo_base.strip() and objetivo_base.lower() != "none":
            objetivos_combinados += f"Meta general: {objetivo_base}. "
            
        if request.objetivo_nutricional and request.objetivo_nutricional.strip():
            objetivos_combinados += f"Enfoque para esta comida: {request.objetivo_nutricional}."
            
        objetivos_combinados = objetivos_combinados.strip()

        # 2. Obtener ingredientes + MACROS desde Supabase
        url_despensa = (
            f"/despensa?user_id=eq.{request.user_id}"
            f"&select=cantidad,unidad,productos(nombre,energia_kcal,proteinas_g,carbohidratos_g,grasas_totales_g)"
        )
        res_despensa = await client.get(url_despensa)
        res_despensa.raise_for_status()
        despensa_data = res_despensa.json()

        if not despensa_data:
            raise HTTPException(status_code=400, detail="La despensa del usuario está vacía")

        # 3. Formatear los ingredientes para la IA
        ingredientes_disponibles = []
        for item in despensa_data:
            prod = item.get("productos")
            if prod:
                texto = (
                    f"- {item['cantidad']} {item['unidad']} de {prod['nombre']} "
                    f"(Info base por 100g: {prod['energia_kcal'] or 0} kcal, "
                    f"{prod['proteinas_g'] or 0}g Prot, {prod['carbohidratos_g'] or 0}g Carb, "
                    f"{prod['grasas_totales_g'] or 0}g Grasas)"
                )
                ingredientes_disponibles.append(texto)

        # 4. Llamar a la IA con los objetivos combinados y los ingredientes obligatorios
        receta_generada = await generar_receta_con_ia(
            ingredientes=ingredientes_disponibles,
            objetivo_nutricional=objetivos_combinados, # <--- ¡Aquí viajan ambos!
            tipo_comida=request.tipo_comida,
            ingredientes_obligatorios=request.ingredientes,
            restricciones_alimentarias=restricciones_alimentarias,
        )
        
        return receta_generada

    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=f"Error en BD: {exc.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


@router.post("/generar-presupuestada")
async def generar_receta_presupuestada(
    request: BudgetRecipeRequest,
    client: httpx.AsyncClient = Depends(get_supabase_client)
):
    try:
        if request.presupuesto <= 0:
            raise HTTPException(status_code=400, detail="El presupuesto debe ser mayor a 0")

        pantry_items = await _get_user_pantry(client, request.user_id)
        if not pantry_items:
            raise HTTPException(status_code=400, detail="La despensa del usuario está vacía")

        profile_context = await _get_profile_context(client, request.user_id)
        restricciones_alimentarias = _merge_unique_text([
            *(profile_context["restricciones"] if request.usar_restricciones_perfil else []),
            *(request.restricciones or []),
        ])
        objetivos_perfil = profile_context["objetivos"]
        objetivo_base = ", ".join(objetivos_perfil)
        objetivos_combinados = ""
        if objetivo_base and objetivo_base.strip() and objetivo_base.lower() != "none":
            objetivos_combinados += f"Meta general: {objetivo_base}. "
        if request.objetivo_nutricional and request.objetivo_nutricional.strip():
            objetivos_combinados += f"Enfoque para esta comida: {request.objetivo_nutricional}."
        objetivos_combinados = objetivos_combinados.strip()

        pantry_names = {
            (item["producto"].get("nombre") or "").lower()
            for item in pantry_items
            if item.get("producto")
        }

        ingredientes_despensa = []
        for item in pantry_items:
            prod = item["producto"]
            ingredientes_despensa.append(
                f"- {item.get('cantidad') or ''} {item.get('unidad') or ''} de {prod.get('nombre')} "
                f"(Info base por 100g: {prod.get('energia_kcal') or 0} kcal, "
                f"{prod.get('proteinas_g') or 0}g Prot, {prod.get('carbohidratos_g') or 0}g Carb, "
                f"{prod.get('grasas_totales_g') or 0}g Grasas)"
            )

        db_candidates = await _find_purchase_candidates(client, pantry_names)
        estimated_candidates = []
        if len(db_candidates) < 5:
            used_names = pantry_names.union({candidate["nombre"].lower() for candidate in db_candidates if candidate.get("nombre")})
            estimated_candidates = await _build_estimated_candidates(used_names, 6 - len(db_candidates))

        all_candidates = [*db_candidates, *estimated_candidates]
        affordable_candidates = [
            candidate for candidate in all_candidates
            if float(candidate.get("precio") or 0) <= request.presupuesto
        ][:8]

        if not affordable_candidates:
            affordable_candidates = sorted(all_candidates, key=lambda item: item.get("precio") or 0)[:4]

        compras_posibles = [
            f"- {item['nombre']} ({item['cantidad']}): CLP {int(item.get('precio') or 0)}. {item.get('reason') or ''}"
            for item in affordable_candidates
        ]

        receta = await generar_receta_presupuestada_con_ia(
            ingredientes_despensa=ingredientes_despensa,
            compras_posibles=compras_posibles,
            presupuesto=request.presupuesto,
            objetivo_nutricional=objetivos_combinados,
            tipo_comida=request.tipo_comida,
            ingredientes_obligatorios=request.ingredientes,
            restricciones_alimentarias=restricciones_alimentarias,
        )

        if "error" in receta:
            return receta

        compras_ia = receta.get("compras_sugeridas") or []
        costo_total = sum(float(item.get("precio") or 0) for item in compras_ia)

        if costo_total > request.presupuesto:
            compras_ia = sorted(compras_ia, key=lambda item: item.get("precio") or 0)
            filtradas = []
            acumulado = 0
            for item in compras_ia:
                precio = float(item.get("precio") or 0)
                if acumulado + precio <= request.presupuesto:
                    filtradas.append(item)
                    acumulado += precio
            receta["compras_sugeridas"] = filtradas
            receta["costo_total"] = acumulado
        else:
            receta["costo_total"] = costo_total

        if not receta.get("compras_sugeridas"):
            receta["compras_sugeridas"] = affordable_candidates[:3]
            receta["costo_total"] = sum(float(item.get("precio") or 0) for item in receta["compras_sugeridas"])

        return receta

    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=f"Error en BD: {exc.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


@router.post("/modificar")
async def modificar_receta(request: RecipeAdjustRequest):
    try:
        if not request.cambios.strip():
            raise HTTPException(status_code=400, detail="Describe qué quieres cambiar de la receta")

        receta = await modificar_receta_con_ia(
            receta=request.receta,
            cambios=request.cambios,
            restricciones_alimentarias=request.restricciones,
            compras_sugeridas=request.compras_sugeridas,
        )

        return receta
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")
