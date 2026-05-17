from fastapi import APIRouter, HTTPException, Depends
from app.models.schemas import RecipeRequest, EsquemaAlimento
from app.services.ai_service import generar_receta_con_ia, obtener_info_nutricional
from app.dependencias import get_supabase_client
import httpx

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
            
        # 3. Preparamos el payload con la estructura exacta de tu tabla en Supabase
        nuevo_producto = {
            "nombre": datos.nombre.strip(),
            "energia_kcal": resultado_ia.get("energia_kcal", 0),
            "proteinas_g": resultado_ia.get("proteinas_g", 0),
            "carbohidratos_g": resultado_ia.get("carbohidratos_g", 0),
            "grasas_totales_g": resultado_ia.get("grasas_totales_g", 0),
            "sodio_mg": resultado_ia.get("sodio_mg", 0)
        }
        
        # 4. Insertamos el nuevo producto en Supabase mediante un POST
        respuesta_insert = await client.post("/productos_catalogo", json=nuevo_producto)
        respuesta_insert.raise_for_status()
        
        datos_insertados = respuesta_insert.json()
        
        # Como tu equipo configuró 'Prefer: return=representation', Supabase devuelve una lista con el registro creado
        return datos_insertados[0] if isinstance(datos_insertados, list) else datos_insertados

    except httpx.HTTPStatusError as exc:
        # Captura errores de respuesta de la API de Supabase (ej. violación de restricciones en la BD)
        raise HTTPException(
            status_code=exc.response.status_code, 
            detail=f"Error en Supabase: {exc.response.text}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en el servidor: {str(e)}")

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
            f"&select=cantidad,unidad,productos_catalogo(nombre,energia_kcal,proteinas_g,carbohidratos_g,grasas_g)"
        )
        res_despensa = await client.get(url_despensa)
        res_despensa.raise_for_status()
        despensa_data = res_despensa.json()

        if not despensa_data:
            raise HTTPException(status_code=400, detail="La despensa del usuario está vacía")

        # 3. Formatear los ingredientes para la IA
        ingredientes_disponibles = []
        for item in despensa_data:
            prod = item.get("productos_catalogo")
            if prod:
                texto = (
                    f"- {item['cantidad']} {item['unidad']} de {prod['nombre']} "
                    f"(Info base por 100g: {prod['energia_kcal'] or 0} kcal, "
                    f"{prod['proteinas_g'] or 0}g Prot, {prod['carbohidratos_g'] or 0}g Carb, "
                    f"{prod['grasas_g'] or 0}g Grasas)"
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