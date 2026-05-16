from fastapi import APIRouter
from app.models.schemas import RecipeRequest, EsquemaAlimento
from app.services.ai_service import generar_receta_con_ia, obtener_info_nutricional

router = APIRouter(
    prefix="/recipes",
    tags=["Recetas"]
)

@router.post("/analizar-alimento")
async def analizar_alimento(datos: EsquemaAlimento):
    # Llamamos a la IA pasándole el nombre del producto
    resultado = await obtener_info_nutricional(datos.nombre)
    return resultado

@router.post("/generar")
async def generar_receta(request: RecipeRequest):
    # Llamamos a tu función pasándole los datos que llegaron
    receta_generada = await generar_receta_con_ia(
        ingredientes=request.ingredientes,
        objetivo_nutricional=request.objetivo_nutricional
    )
    
    # Devolvemos la respuesta
    return receta_generada
