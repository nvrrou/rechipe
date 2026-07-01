import os
from openai import AsyncOpenAI
from dotenv import load_dotenv
import json

# 1. Cargar las variables secretas del archivo .env
load_dotenv()

# 2. Inicializar el cliente de OpenAI
# Automáticamente buscará la variable OPENAI_API_KEY en tu entorno
client = AsyncOpenAI()


NUTRIENT_KEYS = ("energia_kcal", "proteinas_g", "carbohidratos_g", "grasas_totales_g", "sodio_mg")


def _nutrientes_en_cero(datos: dict) -> bool:
    return all(float(datos.get(key) or 0) == 0 for key in NUTRIENT_KEYS)


async def obtener_info_nutricional(nombre_producto: str):
    """
    Toma el nombre de un producto y devuelve su perfil nutricional estándar por 100g en JSON.
    """
    instrucciones = f"""
    Eres un experto en nutrición y bases de datos de alimentos (estilo USDA).
    Tu tarea es proporcionar los valores nutricionales ESTÁNDAR para el siguiente alimento: "{nombre_producto}".
    
    REGLAS CRÍTICAS:
    1. BASE DE CÁLCULO: Todos los valores deben ser calculados estrictamente en base a 100 gramos (o 100 ml) de la porción comestible del alimento en su estado más común (generalmente crudo, a menos que sea un procesado).
    2. TIPOS DE DATOS: Usa únicamente valores numéricos (float o int) para los nutrientes. Si el alimento carece de un nutriente, usa 0. NO agregues símbolos como "g" o "kcal" en los valores, solo el número.
    3. FORMATO DE SALIDA ESTRICTO: Responde ÚNICA Y EXCLUSIVAMENTE con un objeto JSON válido. NO incluyas saludos, ni texto antes o después. NO uses bloques de código markdown (```json).
    
    Estructura requerida:
    {{
        "energia_kcal": número,
        "proteinas_g": número,
        "carbohidratos_g": número,
        "grasas_totales_g": número,
        "sodio_mg": número
    }}
    """

    async def consultar_nutricion(instrucciones_extra: str = ""):
        response = await client.chat.completions.create(
            model="gpt-4o-mini", # Excelente y barato para extraer datos fijos
            messages=[
                {"role": "system", "content": instrucciones + instrucciones_extra}
            ],
            temperature=0.1 # Muy baja para que sea preciso y no "invente" variaciones
        )
        return response.choices[0].message.content

    try:
        contenido = await consultar_nutricion()
        datos_nutricionales = json.loads(contenido)

        if _nutrientes_en_cero(datos_nutricionales):
            contenido = await consultar_nutricion(
                """

                ATENCIÓN: La respuesta anterior quedó con todos los nutrientes en 0.
                Vuelve a estimar el perfil nutricional estándar del alimento.
                Solo usa todos los valores en 0 si el producto realmente no es un alimento reconocible.
                """
            )
            datos_nutricionales = json.loads(contenido)

        return datos_nutricionales

    except json.JSONDecodeError:
        return {"error": "La IA no devolvió un JSON válido", "texto_crudo": contenido}
    except Exception as e:
        return {"error": str(e)}

async def generar_url_temporal_dalle(nombre_producto: str) -> str:
    """
    Llama a la API de OpenAI para generar la imagen de un producto.
    Soporta tanto URLs públicas como respuestas en formato Base64.
    """
    try:
        prompt_estandar = f"""
        A high-resolution, professional studio photograph of a single {nombre_producto}, 
        fresh and appetizing, centered on a pristine, solid white background. 
        Natural, soft lighting. Overhead or slightly elevated angle, suitable for a clean grocery catalogue. 
        No packaging, no text, no logos, no surrounding clutter.
        """

        respuesta = await client.images.generate(
            model="gpt-image-1-mini", 
            prompt=prompt_estandar,
            n=1,
            size="1024x1024"
        )
        
        # 1. Intentamos sacar la URL clásica (por si acaso)
        url_generada = getattr(respuesta.data[0], 'url', None)
        if url_generada:
            return url_generada
            
        # 2. Si no hay URL, extraemos el contenido Base64 (el muro de texto)
        b64_generado = getattr(respuesta.data[0], 'b64_json', None)
        if b64_generado:
            return b64_generado
            
        raise Exception("La API de imágenes no devolvió ni una URL ni datos en Base64.")
        
    except Exception as e:
        raise Exception(f"Error al procesar la imagen de {nombre_producto}: {str(e)}")


async def verificar_categoria_producto(nombre_producto: str, categoria_actual: str, categorias_disponibles: list[str]):
    """
    Revisa si la categoria elegida calza con el producto y sugiere otra si corresponde.
    """
    categorias = [categoria for categoria in categorias_disponibles if categoria]
    instrucciones = f"""
    Eres un clasificador de alimentos para una app de despensa.
    Producto: "{nombre_producto}"
    Categoria elegida: "{categoria_actual}"
    Categorias disponibles: {categorias}

    Decide si la categoria elegida es suficientemente correcta.
    Reglas:
    1. Si la categoria elegida es correcta o razonable, responde requiere_cambio=false.
    2. Si claramente hay una mejor categoria disponible, responde requiere_cambio=true.
    3. La categoria_sugerida DEBE ser exactamente una de las categorias disponibles.
    4. No recomiendes cambios por detalles menores.
    5. Responde solo JSON valido, sin markdown.

    Formato:
    {{
      "requiere_cambio": boolean,
      "categoria_sugerida": string | null,
      "razon": string
    }}
    """

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "system", "content": instrucciones}],
            temperature=0.1,
        )
        contenido = response.choices[0].message.content
        resultado = json.loads(contenido)
        sugerida = resultado.get("categoria_sugerida")

        if sugerida not in categorias:
            resultado["requiere_cambio"] = False
            resultado["categoria_sugerida"] = None

        return resultado
    except json.JSONDecodeError:
        return {"error": "La IA no devolvió un JSON válido", "texto_crudo": contenido}
    except Exception as e:
        return {"error": str(e)}


async def identificar_producto_por_codigo_barras(codigo_barra: str, categorias_disponibles: list[str] | None = None):
    """
    Intenta identificar un producto solo desde su codigo de barras.
    Devuelve datos listos para crear el producto cuando no esta en la base.
    """
    categorias = [categoria for categoria in (categorias_disponibles or []) if categoria]
    categorias_texto = categorias or ["Carnes", "Vegetales", "Frutas", "Legumbres", "Mariscos", "Pescado", "Aderezos", "Cereales", "Lácteos", "Jugos", "Bebidas", "Otros"]
    instrucciones = f"""
    Eres un asistente para una app chilena de despensa.
    Identifica el producto asociado al codigo de barras "{codigo_barra}" usando solo ese codigo.

    Reglas:
    1. Responde solo JSON valido, sin markdown.
    2. Si reconoces el codigo, usa el nombre comercial mas probable.
    3. Si no puedes reconocerlo con certeza, usa un nombre descriptivo como "Producto codigo {codigo_barra}".
    4. La categoria debe ser exactamente una de estas: {categorias_texto}.
    5. Los nutrientes son por 100 g o 100 ml, usando numeros. Si no sabes un valor, usa 0.
    6. Si el codigo parece corresponder a un producto que no es alimento o bebida, marca es_alimento=false.
    7. Busca ESPECIFICAMENTE productos comunes en supermercados chilenos. Si el codigo es muy genérico o no corresponde a un producto alimenticio, responde con es_alimento=false y pon un aviso breve en "aviso".
    8. NO INVENTES PRODUCTOS: Si el codigo no es reconocible o parece ser un producto no alimenticio, no trates de inventar un alimento. En ese caso, pon es_alimento=false y un aviso breve explicando que no se pudo identificar o que no es un alimento.

    Formato:
    {{
      "es_alimento": boolean,
      "nombre_producto": "string",
      "categoria": "string",
      "marca": "string o null",
      "aviso": "string breve si no es alimento o null",
      "energia_kcal": numero,
      "proteinas_g": numero,
      "carbohidratos_g": numero,
      "grasas_g": numero,
      "fibra_g": numero,
      "sodio_mg": numero,
      "azucar_g": numero
    }}
    """

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "system", "content": instrucciones}],
            temperature=0.1,
        )
        contenido = response.choices[0].message.content.strip()
        if contenido.startswith("```json"):
            contenido = contenido.replace("```json", "", 1)
        elif contenido.startswith("```"):
            contenido = contenido.replace("```", "", 1)
        if contenido.endswith("```"):
            contenido = contenido.rsplit("```", 1)[0]

        resultado = json.loads(contenido.strip())
        if "es_alimento" not in resultado:
            resultado["es_alimento"] = True
        if resultado.get("categoria") not in categorias_texto:
            resultado["categoria"] = "Otros" if "Otros" in categorias_texto else categorias_texto[0]
        return resultado
    except json.JSONDecodeError:
        return {"error": "La IA no devolvió un JSON válido", "texto_crudo": contenido}
    except Exception as e:
        return {"error": str(e)}

async def generar_receta_con_ia(
    ingredientes: list,
    objetivo_nutricional: str,
    tipo_comida: str,
    ingredientes_obligatorios: list = None,
    restricciones_alimentarias: list = None,
):
    """
    Toma una lista de ingredientes (con sus macros), un objetivo (combinado) y un tipo de comida,
    y devuelve una receta generada por IA calculando el total nutricional.
    Incluye soporte para ingredientes obligatorios que pide el frontend.
    """
    try:
        lista_ingredientes = "\n".join(ingredientes)
        
        restricciones = ", ".join(restricciones_alimentarias or [])

        instrucciones = f"""
        Eres un chef experto y nutricionista de precisión. El usuario quiere un/a {tipo_comida}. 
        Su contexto y objetivos son: {objetivo_nutricional}.
        Restricciones alimentarias del usuario: {restricciones or "ninguna"}.
        
        INGREDIENTES DISPONIBLES EN SU DESPENSA:
        {lista_ingredientes}
        
        Extras permitidos: Agua, sal y aceite.

        CONTEXTO DE COCINA:
        - Las recetas deben ser sencillas, prácticas y diseñadas para hacerse en una casa común.
        - Utiliza utensilios básicos (sartenes, ollas, horno convencional).
        
        REGLAS CRÍTICAS:
        1. EXPRIME LA DESPENSA: Genera como máximo 3 recetas DISTINTAS que tengan sentido culinario para un/a {tipo_comida}. Nunca devuelvas más de 3 opciones.
        2. CERO INGREDIENTES EXTERNOS: Solo puedes usar los ingredientes de la lista (más agua, sal y aceite).
        3. CÁLCULO NUTRICIONAL ESTRICTO: Por cada receta, calcula el TOTAL de kcal, proteínas, carbohidratos y grasas sumando las porciones, basándote ÚNICAMENTE en la 'Info base por 100g' proporcionada.
        4. RESPETA RESTRICCIONES: No uses ni sugieras ingredientes que contradigan las restricciones alimentarias del usuario.
        """
        
        # --- REGLA 4: INGREDIENTES OBLIGATORIOS (Vienen del Frontend) ---
        if ingredientes_obligatorios and len(ingredientes_obligatorios) > 0:
            nombres_obligatorios = ", ".join(ingredientes_obligatorios)
            instrucciones += f"\n5. INGREDIENTES OBLIGATORIOS: Tienes que incluir SÍ O SÍ los siguientes ingredientes en TODAS las recetas que generes: {nombres_obligatorios}."
        else:
            instrucciones += "\n5. No hay ingredientes obligatorios, elige los que combinen mejor."

        # --- REGLA 5: OBJETIVOS (Combinados del perfil + frontend) ---
        if objetivo_nutricional:
            instrucciones += f"\n6. OBJETIVO NUTRICIONAL: Asegúrate de incluir la sección 'por_que_funciona' explicando cómo la receta ayuda a cumplir con: {objetivo_nutricional}."
        else:
            instrucciones += "\n6. No se ha proporcionado un objetivo nutricional. Pon null en 'por_que_funciona'."

        instrucciones += """\n
        FORMATO DE SALIDA ESTRICTO (JSON):
        El array "recetas" debe contener entre 1 y 3 opciones como máximo.
        {
          "recetas": [
            {
              "titulo": "Nombre de la receta",
              "tiempo_preparacion": "Ej: 20 min",
              "dificultad": "Fácil, Media o Difícil",
              "por_que_funciona": "Explicación de cómo cumple los objetivos o null",
              "macros_totales": {
                  "calorias": numero,
                  "proteinas": numero,
                  "carbohidratos": numero,
                  "grasas": numero
              },
              "ingredientes": [
                "Cantidad exacta + ingrediente 1",
                "Cantidad exacta + ingrediente 2"
              ],
              "pasos": [
                "1. Primer paso...",
                "2. Segundo paso..."
              ]
            }
          ]
        }
        """

        respuesta = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Eres un asistente de cocina útil y un nutricionista matemático."},
                {"role": "user", "content": instrucciones}
            ],
            temperature=0.4, 
        )

        contenido = respuesta.choices[0].message.content
        
        # --- BLINDAJE CONTRA MARKDOWN ---
        contenido = contenido.strip()
        if contenido.startswith("```json"):
            contenido = contenido.replace("```json", "", 1)
        elif contenido.startswith("```"):
            contenido = contenido.replace("```", "", 1)
            
        if contenido.endswith("```"):
            contenido = contenido.rsplit("```", 1)[0]
            
        contenido = contenido.strip()
        
        try:
            return json.loads(contenido)
        except json.JSONDecodeError:
            return {"error": "La IA no devolvió un JSON válido", "texto_crudo": contenido}
            
    except Exception as e:
        return {"error": f"Ups, hubo un error al generar la receta: {str(e)}"}


async def estimar_precio_producto_chile(nombre_producto: str, categoria: str = "", supermercados: list[dict] | None = None):
    """
    Estima un precio minorista chileno para un producto cuando no hay precio en BD.
    """
    supermercados_disponibles = [
        {
            "id": item.get("id"),
            "nombre": item.get("nombre"),
            "cadena": item.get("cadena"),
            "direccion": item.get("direccion"),
        }
        for item in (supermercados or [])
        if item.get("id") and item.get("nombre")
    ]
    instrucciones = f"""
    Estima un precio de supermercado en Chile para el producto "{nombre_producto}".
    Categoria: "{categoria}".
    Supermercados registrados disponibles: {supermercados_disponibles or "ninguno"}.

    Usa precios realistas en pesos chilenos para una compra domestica común.
    Si hay supermercados registrados, elige el supermercado más razonable para ese producto
    usando exclusivamente uno de la lista y devuelve su id y nombre exactos.
    Responde solo JSON valido, sin markdown.

    Formato:
    {{
      "nombre": "{nombre_producto}",
      "categoria": "{categoria}",
      "cantidad": "ej: 1 kg, 500 g, 12 unidades",
      "precio": numero_entero_en_CLP,
      "supermercado_id": "id exacto de supermercado o null",
      "supermercado_nombre": "nombre exacto de supermercado o null",
      "razon": "breve motivo de la estimacion"
    }}
    """
    try:
      response = await client.chat.completions.create(
          model="gpt-4o-mini",
          messages=[{"role": "system", "content": instrucciones}],
          temperature=0.2,
      )
      contenido = response.choices[0].message.content.strip()
      if contenido.startswith("```json"):
          contenido = contenido.replace("```json", "", 1)
      elif contenido.startswith("```"):
          contenido = contenido.replace("```", "", 1)
      if contenido.endswith("```"):
          contenido = contenido.rsplit("```", 1)[0]
      return json.loads(contenido.strip())
    except json.JSONDecodeError:
      return {"error": "La IA no devolvió un JSON válido", "texto_crudo": contenido}
    except Exception as e:
      return {"error": str(e)}


async def generar_receta_presupuestada_con_ia(
    ingredientes_despensa: list,
    compras_posibles: list,
    presupuesto: float,
    objetivo_nutricional: str,
    tipo_comida: str,
    ingredientes_obligatorios: list = None,
    restricciones_alimentarias: list = None,
):
    """
    Genera receta usando despensa y compras posibles dentro de presupuesto.
    """
    lista_despensa = "\n".join(ingredientes_despensa)
    lista_compras = "\n".join(compras_posibles)
    obligatorios = ", ".join(ingredientes_obligatorios or [])
    restricciones = ", ".join(restricciones_alimentarias or [])
    instrucciones = f"""
    Eres chef y planificador de compras en Chile.
    Genera 3 recetas distintas para {tipo_comida} usando los ingredientes disponibles en despensa y compras adicionales concretas.

    Presupuesto máximo para compras adicionales: CLP {int(presupuesto)}.
    Objetivo del usuario: {objetivo_nutricional or "sin objetivo específico"}.
    Restricciones alimentarias del usuario: {restricciones or "ninguna"}.

    DESPENSA DISPONIBLE:
    {lista_despensa}

    COMPRAS POSIBLES CON PRECIO Y SUPERMERCADO:
    {lista_compras}

    Reglas:
    1. Devuelve exactamente 3 recetas distintas.
    2. Cada receta puede usar libremente ingredientes de despensa.
    3. Las compras adicionales de la lista compras_sugeridas deben sumar como máximo CLP {int(presupuesto)}.
    4. Si la despensa permite una receta razonable, una de las 3 recetas debe ser "solo despensa", sin compras_usadas y con costo_estimado 0. No es obligatorio si culinariamente no alcanza.
    5. Las compras_sugeridas NO son opcionales ni decorativas: toda compra sugerida debe aparecer explícitamente en los ingredientes de al menos una receta.
    6. Si una compra no aporta a ninguna receta, no la sugieras.
    7. Devuelve una lista "compras_sugeridas" con precio, cantidad, supermercado_id, supermercado_nombre y reason explicando qué rol cumple en las recetas.
    8. Ingredientes obligatorios de despensa: {obligatorios or "ninguno"}.
    9. Si hay ingredientes obligatorios, deben aparecer en todas las recetas finales.
    10. Respeta las restricciones alimentarias: no uses ni sugieras productos que las contradigan.
    11. Devuelve "compras_usadas" dentro de cada receta con los nombres exactos de compras_sugeridas que esa receta utiliza; para la receta solo despensa usa [].
    12. Responde solo JSON valido, sin markdown.

    Formato:
    {{
      "recetas": [
        {{
          "titulo": "Nombre",
          "tiempo_preparacion": "Ej: 25 min",
          "dificultad": "Fácil",
          "por_que_funciona": "Por qué cumple presupuesto y objetivo",
          "costo_estimado": numero,
          "macros_totales": {{"calorias": numero, "proteinas": numero, "carbohidratos": numero, "grasas": numero}},
          "compras_usadas": ["Producto comprado usado en la receta"],
          "ingredientes": ["..."],
          "pasos": ["..."]
        }}
      ],
      "compras_sugeridas": [
        {{"nombre": "Producto", "categoria": "Categoria", "cantidad": "1 kg", "precio": numero, "supermercado_id": "id o null", "supermercado_nombre": "Nombre o null", "reason": "Motivo"}}
      ],
      "costo_total": numero
    }}
    """
    try:
      response = await client.chat.completions.create(
          model="gpt-4o-mini",
          messages=[
              {"role": "system", "content": "Eres un asistente de cocina y presupuesto para supermercados chilenos."},
              {"role": "user", "content": instrucciones},
          ],
          temperature=0.35,
      )
      contenido = response.choices[0].message.content.strip()
      if contenido.startswith("```json"):
          contenido = contenido.replace("```json", "", 1)
      elif contenido.startswith("```"):
          contenido = contenido.replace("```", "", 1)
      if contenido.endswith("```"):
          contenido = contenido.rsplit("```", 1)[0]
      return json.loads(contenido.strip())
    except json.JSONDecodeError:
      return {"error": "La IA no devolvió un JSON válido", "texto_crudo": contenido}
    except Exception as e:
      return {"error": str(e)}


async def generar_plan_semanal_con_ia(
    contexto_usuario: dict,
    ingredientes_despensa: list,
    presupuesto_disponible: float,
    preferencias_semana: str = "",
    permitir_comidas_intermedias: bool = False,
    dias: int = 7,
    comidas_por_dia: int = 3,
):
    """
    Genera un plan semanal en una sola llamada para mantener baja la latencia.
    """
    despensa = "\n".join(ingredientes_despensa[:60])
    regla_comidas_intermedias = (
        """
    Comidas intermedias: ACTIVADAS por el usuario.
    Si el perfil y objetivos requieren mayor cantidad de macros totales o energia, puedes agregar 1 o 2 comidas intermedias por dia.
    Usa tipos como "Colacion media manana", "Merienda" o "Snack entre almuerzo y cena".
    Deben ser simples y realistas, como pan, fruta, yogurt, frutos secos, huevo, avena u otro alimento SOLO si existe en despensa.
    """
        if permitir_comidas_intermedias
        else """
    Comidas intermedias: DESACTIVADAS por el usuario.
    No agregues colaciones, meriendas ni snacks como comidas separadas. Usa solo las comidas principales solicitadas.
    """
    )
    instrucciones = f"""
    Eres planificador nutricional y de compras en Chile.
    Genera un plan de {dias} dias con al menos {comidas_por_dia} comidas principales por dia.

    Perfil del usuario desde la tabla profiles JSON:
    {json.dumps(contexto_usuario, ensure_ascii=False)}

    Usa SOLO los datos reales del perfil para orientar la planificacion:
    - objetivos: interpreta cada objetivo exactamente como viene en profiles.objetivos.
    - edad, peso_kg, altura_cm y genero: usalos para ajustar porciones, densidad energetica y macros de forma razonable.
    - restricciones: son obligatorias.
    - ingredientes_favoritos: priorizalos si estan disponibles en despensa.
    No apliques metas fijas universales ni sesgos por defecto. Si hay varios objetivos, balancealos y explica el criterio en el resumen.

    Cosas que el usuario quiere esta semana:
    {preferencias_semana.strip() or "sin preferencias semanales adicionales"}

    Opcion de comidas intermedias:
    {regla_comidas_intermedias}

    Despensa disponible:
    {despensa or "sin despensa registrada"}

    Reglas:
    1. Usa gustos, objetivos y restricciones del usuario como prioridad nutricional real, no decorativa.
    2. Mantén variedad y comidas balanceadas.
    3. Usa exclusivamente la despensa disponible y los ingredientes/gustos del perfil del usuario.
    4. No sugieras compras adicionales ni ingredientes que no estén en la despensa, salvo básicos de cocina como agua, sal, pimienta o aceite.
    5. Integra las preferencias semanales del usuario cuando no choquen con restricciones o ingredientes disponibles.
    6. Genera al menos 3 recetas distintas en toda la semana y alternarlas entre dias; no repitas el mismo titulo en dias consecutivos.
    7. Cada comida/receta debe incluir macros_totales con calorias, proteinas, carbohidratos y grasas calculadas segun sus ingredientes de despensa.
    8. Cada dia debe incluir resumen de macros: calorias_estimadas, proteinas_g, carbohidratos_g y grasas_g, exactamente como suma de macros_totales de sus comidas.
    9. Ajusta las porciones y la distribucion de macros al perfil completo; no fuerces todas las recetas hacia un unico objetivo si el perfil no lo pide.
    10. Respeta la opcion de comidas intermedias: si esta desactivada, no agregues snacks ni colaciones; si esta activada, agregalas solo si ayudan al objetivo/perfil.
    11. Las comidas intermedias tambien deben usar solo despensa y deben traer macros_totales.
    12. No agregues colaciones si no son necesarias para el perfil o si la despensa no tiene ingredientes adecuados.
    13. Devuelve solo JSON valido, sin markdown.
    14. No hagas recetas largas: maximo 3 pasos por comida.

    Formato:
    {{
      "resumen": "string",
      "presupuesto_usado": 0,
      "dias": [
        {{
          "dia": "Lunes",
          "costo_estimado": numero,
          "calorias_estimadas": numero,
          "proteinas_g": numero,
          "carbohidratos_g": numero,
          "grasas_g": numero,
          "comidas": [
            {{
              "tipo": "Desayuno",
              "titulo": "string",
              "ingredientes": ["string"],
              "pasos": ["string"],
              "costo_estimado": numero,
              "macros_totales": {{
                "calorias": numero,
                "proteinas": numero,
                "carbohidratos": numero,
                "grasas": numero
              }},
              "por_que": "string"
            }}
          ]
        }}
      ],
      "compras_sugeridas": []
    }}
    """
    contenido = ""
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Eres un planificador semanal rapido, nutricional y presupuestario."},
                {"role": "user", "content": instrucciones},
            ],
            temperature=0.35,
        )
        contenido = response.choices[0].message.content.strip()
        if contenido.startswith("```json"):
            contenido = contenido.replace("```json", "", 1)
        elif contenido.startswith("```"):
            contenido = contenido.replace("```", "", 1)
        if contenido.endswith("```"):
            contenido = contenido.rsplit("```", 1)[0]
        return json.loads(contenido.strip())
    except json.JSONDecodeError:
        return {"error": "La IA no devolvio un JSON valido", "texto_crudo": contenido}
    except Exception as e:
        return {"error": str(e)}


async def generar_pack_recetas_grupo_con_ia(
    ingredientes_despensa: list,
    miembros: list,
    objetivo_nutricional: str,
    tipo_comida: str,
    ingredientes_obligatorios: list = None,
    restricciones_alimentarias: list = None,
    presupuestada: bool = False,
    presupuesto: float | None = None,
    compras_posibles: list = None,
):
    """
    Genera un pack social: una receta por integrante, con una base comun y ajustes por persona.
    """
    lista_despensa = "\n".join(ingredientes_despensa)
    obligatorios = ", ".join(ingredientes_obligatorios or [])
    restricciones_extra = ", ".join(restricciones_alimentarias or [])
    miembros_json = json.dumps(miembros, ensure_ascii=False)
    compras = "\n".join(compras_posibles or [])
    presupuesto_texto = (
        f"Presupuesto maximo total para compras adicionales: CLP {int(presupuesto or 0)}."
        if presupuestada
        else "No hay presupuesto activo; usa solo despensa salvo agua, sal y aceite."
    )

    instrucciones = f"""
    Eres chef, nutricionista y planificador de comidas sociales.
    Debes crear un pack para {tipo_comida}: una receta para cada integrante del grupo.

    Objetivo comun del plan: {objetivo_nutricional or "sin objetivo comun especifico"}.
    Restricciones extra indicadas por quien genera: {restricciones_extra or "ninguna"}.
    Ingredientes obligatorios que deben aparecer como base comun si existen: {obligatorios or "ninguno"}.
    {presupuesto_texto}

    INTEGRANTES DEL GRUPO JSON:
    {miembros_json}

    DESPENSA DISPONIBLE:
    {lista_despensa}

    COMPRAS POSIBLES CON PRECIO Y SUPERMERCADO:
    {compras or "ninguna"}

    Reglas:
    1. Devuelve una receta por cada integrante recibido, manteniendo persona_id y persona_nombre.
    2. Intenta encontrar una base comun entre recetas cuando sea natural y util, por ejemplo arroz, avena, pasta, legumbres o verduras.
    3. No fuerces la base comun si arruina las preferencias, restricciones, presupuesto o calidad culinaria del pack.
    4. Ajusta cada receta segun restricciones, ingredientes favoritos y objetivos del integrante.
    5. Si una persona no tiene preferencias y otra si, procura compartir algun componente y cambia el acompanamiento/proteina segun corresponda.
    6. Respeta restricciones vegetarianas, alergias, sin lactosa, sin gluten u otras indicadas.
    7. Usa ingredientes de despensa y extras basicos: agua, sal y aceite.
    8. Si presupuestada=true, usa solo compras_posibles y que costo_total no supere el presupuesto.
    9. Si sugieres compras, conserva supermercado_id y supermercado_nombre desde compras_posibles.
    10. Si hay ingredientes obligatorios, usalos en todas las recetas cuando sea culinariamente posible.
    11. Responde solo JSON valido, sin markdown.

    Formato:
    {{
      "recetas": [
        {{
          "persona_id": "uuid",
          "persona_nombre": "Nombre",
          "ingrediente_comun": "Base compartida",
          "titulo": "Nombre",
          "tiempo_preparacion": "Ej: 25 min",
          "dificultad": "Facil",
          "por_que_funciona": "Como responde a los gustos/objetivos de esta persona",
          "costo_estimado": numero,
          "macros_totales": {{"calorias": numero, "proteinas": numero, "carbohidratos": numero, "grasas": numero}},
          "compras_usadas": ["Producto comprado usado en la receta"],
          "ingredientes": ["Cantidad + ingrediente"],
          "pasos": ["1. Paso..."]
        }}
      ],
      "compras_sugeridas": [
        {{"nombre": "Producto", "categoria": "Categoria", "cantidad": "1 kg", "precio": numero, "supermercado_id": "id o null", "supermercado_nombre": "Nombre o null", "reason": "Motivo"}}
      ],
      "costo_total": numero
    }}
    """

    contenido = ""
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Eres un asistente de cocina social que adapta comidas por persona."},
                {"role": "user", "content": instrucciones},
            ],
            temperature=0.38,
        )
        contenido = response.choices[0].message.content.strip()
        if contenido.startswith("```json"):
            contenido = contenido.replace("```json", "", 1)
        elif contenido.startswith("```"):
            contenido = contenido.replace("```", "", 1)
        if contenido.endswith("```"):
            contenido = contenido.rsplit("```", 1)[0]
        return json.loads(contenido.strip())
    except json.JSONDecodeError:
        return {"error": "La IA no devolvio un JSON valido", "texto_crudo": contenido}
    except Exception as e:
        return {"error": str(e)}


async def modificar_receta_con_ia(
    receta: dict,
    cambios: str,
    restricciones_alimentarias: list = None,
    compras_sugeridas: list = None,
):
    restricciones = ", ".join(restricciones_alimentarias or [])
    instrucciones = f"""
    Eres chef y nutricionista. Modifica la receta existente segun la solicitud del usuario.

    RECETA ACTUAL JSON:
    {json.dumps(receta, ensure_ascii=False)}

    COMPRAS SUGERIDAS DISPONIBLES JSON:
    {json.dumps(compras_sugeridas or [], ensure_ascii=False)}

    SOLICITUD DEL USUARIO:
    {cambios}

    Restricciones alimentarias que debes respetar: {restricciones or "ninguna"}.

    Reglas:
    1. Mantén el mismo formato de receta.
    2. Cambia solo lo necesario para cumplir la solicitud.
    3. Respeta restricciones alimentarias.
    4. Si usas compras sugeridas, decláralas en "compras_usadas" con nombres exactos.
    5. Si la receta queda sin compras, usa "compras_usadas": [].
    6. La clave "ingredientes" debe contener SIEMPRE la lista completa de ingredientes usados en la receta final, con cantidad + ingrediente.
    7. No omitas ingredientes que sigan apareciendo en los pasos, compras_usadas o solicitud del usuario.
    8. Si reemplazas o quitas un ingrediente, actualiza tambien los pasos para que coincidan.
    9. Recalcula por_que_funciona, macros_totales aproximados, ingredientes y pasos.
    10. Responde solo JSON valido, sin markdown.

    Formato:
    {{
      "recetas": [
        {{
          "titulo": "Nombre",
          "tiempo_preparacion": "Ej: 25 min",
          "dificultad": "Fácil",
          "por_que_funciona": "Explicación breve",
          "costo_estimado": numero,
          "macros_totales": {{"calorias": numero, "proteinas": numero, "carbohidratos": numero, "grasas": numero}},
          "compras_usadas": ["Producto comprado usado en la receta"],
          "ingredientes": ["..."],
          "pasos": ["..."]
        }}
      ]
    }}
    """
    try:
      response = await client.chat.completions.create(
          model="gpt-4o-mini",
          messages=[
              {"role": "system", "content": "Eres un asistente de cocina que edita recetas sin perder estructura."},
              {"role": "user", "content": instrucciones},
          ],
          temperature=0.35,
      )
      contenido = response.choices[0].message.content.strip()
      if contenido.startswith("```json"):
          contenido = contenido.replace("```json", "", 1)
      elif contenido.startswith("```"):
          contenido = contenido.replace("```", "", 1)
      if contenido.endswith("```"):
          contenido = contenido.rsplit("```", 1)[0]
      return json.loads(contenido.strip())
    except json.JSONDecodeError:
      return {"error": "La IA no devolvió un JSON válido", "texto_crudo": contenido}
    except Exception as e:
      return {"error": str(e)}
