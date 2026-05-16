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

async def generar_receta_con_ia(ingredientes: list[str], objetivo_nutricional: str = "") -> str:
    """
    Toma una lista de ingredientes y un objetivo, y devuelve una receta generada por IA.
    """
    try:
        # Preparamos los ingredientes como texto (ej: "pollo, arroz, tomate")
        lista_ingredientes = ", ".join(ingredientes)
        
        # 3. Armar el "Prompt" (Las instrucciones precisas para la IA)
        instrucciones = f"""
        Eres un chef experto y nutricionista con pensamiento lógico, tu objetivo es ayudar a personas a cocinar con lo que tienen en su despensa. 
        Solo tienes estos ingredientes: {lista_ingredientes}.
        Extras permitidos: Agua, sal y aceite.

        CONTEXTO DE COCINA:
        - Las recetas deben ser sencillas, prácticas y diseñadas para hacerse en una casa común.
        - Utiliza utensilios básicos (sartenes, ollas, horno convencional).
        - Tiempo de preparación razonable para el día a día.
        
        REGLAS CRÍTICAS:
        1. MÁXIMA VARIEDAD (EXPRIME LA DESPENSA): Genera la MAYOR cantidad de recetas DISTINTAS posibles que tengan sentido culinario. Pero tampoco inventes variaciones para rellenar.
        2. PROHIBICIÓN TOTAL: Cero ingredientes externos (excepto agua, sal, aceite).
        3. SEPARACIÓN DE BASES: Si en la lista hay diferentes carbohidratos (ej. arroz, fideos, papas, quinoa), OBLIGATORIAMENTE debes crear al menos una receta diferente protagonizada por cada uno de ellos. No los mezcles todos en un solo plato por pereza. 
        4. RUTHLESS (Despiadado): Si un ingrediente contradice el objetivo nutricional (ej. tocino en una dieta baja en grasas), ELIMÍNALO por completo de la receta. No lo sugieras ni como "opcional".
        5. ESTRUCTURA INQUEBRANTABLE: Debes respetar el orden exacto del formato solicitado. "Por qué funciona" SIEMPRE va justo después del título.
        """
        
        # Lógica condicional para el objetivo nutricional
        if objetivo_nutricional:
            instrucciones += f"\n5. OBJETIVO NUTRICIONAL: {objetivo_nutricional}. Todas las opciones de recetas deben cumplir con este objetivo nutricional y en este caso, incluye la sección 'Por qué funciona'."
        else:
            instrucciones += "\n5. No se ha proporcionado un objetivo nutricional, por lo tanto, sé directo y no des explicaciones de salud."

        instrucciones += """\n
        FORMATO DE SALIDA ESTRICTO:
        Debes responder ÚNICA Y EXCLUSIVAMENTE con un objeto JSON válido. NO incluyas texto antes ni después del JSON. NO uses bloques de código markdown (```json).
        
        Estructura requerida:
        {
          "recetas": [
            {
              "titulo": "Nombre de la receta",
              "tiempo_preparacion": "Ej: 20 min",
              "dificultad": "Fácil, Media o Difícil",
              "por_que_funciona": "Explicación del objetivo o null si no aplica",
              "ingredientes": [
                "Cantidad + ingrediente 1",
                "Cantidad + ingrediente 2"
              ],
              "pasos": [
                "1. Primer paso...",
                "2. Segundo paso..."
              ]
            }
          ]
        }
        """

        # 4. Hacer la llamada a la API
        # Usamos gpt-4o-mini porque es rápido, muy inteligente y económico para la fase de pruebas
        respuesta = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Eres un asistente de cocina útil y un nutricionista profesional."},
                {"role": "user", "content": instrucciones}
            ],
            temperature=0.7, # 0.7 le da un buen equilibrio entre coherencia y creatividad
        )

        # Obtenemos el texto crudo de la IA
        contenido = respuesta.choices[0].message.content
        
        try:
            # Convertimos el texto (String) a un diccionario real de Python (JSON)
            recetas_json = json.loads(contenido)
            return recetas_json
        except json.JSONDecodeError:
            # Por si acaso la IA se equivoca y manda texto normal, evitamos que la app explote
            return {"error": "La IA no devolvió un JSON válido", "texto_crudo": contenido}
    

    except Exception as e:
        # Si algo falla (ej. sin internet o llave incorrecta), no rompemos el servidor
        return f"Ups, hubo un error al generar la receta: {str(e)}"
