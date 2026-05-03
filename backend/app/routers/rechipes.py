from fastapi import APIRouter

router = APIRouter(
    prefix="/recipes",
    tags=["Recetas"]
)

# Aquí irán los endpoints de generación y guardado de recetas
