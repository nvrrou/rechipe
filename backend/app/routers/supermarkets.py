from fastapi import APIRouter

router = APIRouter(
    prefix="/supermarkets",
    tags=["Supermercados"]
)

# Aquí irán los endpoints de búsqueda de supermercados y precios
