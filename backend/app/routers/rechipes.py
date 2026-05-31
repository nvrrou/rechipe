from fastapi import APIRouter, HTTPException, Depends
from app.models.schemas import RecipeRequest, EsquemaAlimento
from app.services.ai_service import generar_receta_con_ia, obtener_info_nutricional, generar_url_temporal_dalle
from app.dependencias import get_supabase_client
import httpx
import uuid


router = APIRouter(
    prefix="/recipes",
    tags=["Recetas"]
)

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
        # 1. Obtener los objetivos del usuario desde la tabla 'profiles'
        res_perfil = await client.get(f"/profiles?id=eq.{request.user_id}&select=objetivos")
        res_perfil.raise_for_status()
        perfil_data = res_perfil.json()
        
        if not perfil_data:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
            
        objetivos_perfil = perfil_data[0].get("objetivos", [])
        objetivo_base = ", ".join(objetivos_perfil) if isinstance(objetivos_perfil, list) else str(objetivos_perfil)

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
            ingredientes_obligatorios=request.ingredientes
        )
        
        return receta_generada

    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=f"Error en BD: {exc.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")
