from fastapi import APIRouter
from app.models.schemas import RecipeRequest
from app.services.ai_service import generar_receta_con_ia

router = APIRouter(
    prefix="/recipes",
    tags=["Recetas"]
)


@router.post("/generar")
async def generar_receta(request: RecipeRequest):
    # Llamamos a tu función pasándole los datos que llegaron
    receta_generada = await generar_receta_con_ia(
        ingredientes=request.ingredientes,
        objetivo_nutricional=request.objetivo_nutricional
    )
    
    # Devolvemos la respuesta
    return receta_generada
