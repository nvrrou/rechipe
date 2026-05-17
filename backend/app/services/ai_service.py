import os
from openai import AsyncOpenAI
from dotenv import load_dotenv
import json

# 1. Cargar las variables secretas del archivo .env
load_dotenv()

# 2. Inicializar el cliente de OpenAI
# Automáticamente buscará la variable OPENAI_API_KEY en tu entorno
client = AsyncOpenAI()


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

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini", # Excelente y barato para extraer datos fijos
            messages=[
                {"role": "system", "content": instrucciones}
            ],
            temperature=0.1 # Muy baja para que sea preciso y no "invente" variaciones
        )
        
        contenido = response.choices[0].message.content
        
        # Convertimos el texto (String) a un diccionario real de Python (JSON)
        datos_nutricionales = json.loads(contenido)
        return datos_nutricionales
        
    except json.JSONDecodeError:
        return {"error": "La IA no devolvió un JSON válido", "texto_crudo": contenido}
    except Exception as e:
        return {"error": str(e)}

async def generar_receta_con_ia(ingredientes: list, objetivo_nutricional: str, tipo_comida: str, ingredientes_obligatorios: list = None):
    """
    Toma una lista de ingredientes (con sus macros), un objetivo (combinado) y un tipo de comida,
    y devuelve una receta generada por IA calculando el total nutricional.
    Incluye soporte para ingredientes obligatorios que pide el frontend.
    """
    try:
        lista_ingredientes = "\n".join(ingredientes)
        
        instrucciones = f"""
        Eres un chef experto y nutricionista de precisión. El usuario quiere un/a {tipo_comida}. 
        Su contexto y objetivos son: {objetivo_nutricional}.
        
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
        """
        
        # --- REGLA 4: INGREDIENTES OBLIGATORIOS (Vienen del Frontend) ---
        if ingredientes_obligatorios and len(ingredientes_obligatorios) > 0:
            nombres_obligatorios = ", ".join(ingredientes_obligatorios)
            instrucciones += f"\n4. INGREDIENTES OBLIGATORIOS: Tienes que incluir SÍ O SÍ los siguientes ingredientes en TODAS las recetas que generes: {nombres_obligatorios}."
        else:
            instrucciones += "\n4. No hay ingredientes obligatorios, elige los que combinen mejor."

        # --- REGLA 5: OBJETIVOS (Combinados del perfil + frontend) ---
        if objetivo_nutricional:
            instrucciones += f"\n5. OBJETIVO NUTRICIONAL: Asegúrate de incluir la sección 'por_que_funciona' explicando cómo la receta ayuda a cumplir con: {objetivo_nutricional}."
        else:
            instrucciones += "\n5. No se ha proporcionado un objetivo nutricional. Pon null en 'por_que_funciona'."

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
