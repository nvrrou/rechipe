from fastapi import APIRouter

router = APIRouter(
    prefix="/users",
    tags=["Usuarios"]
)

# Aquí irán los endpoints del perfil del usuario
