from app.config import SUPABASE_URL
from fastapi import APIRouter
from app.models.schemas import UserCreate, UserResponse
from app.dependencias import get_supabase_client
from app.models.schemas import UserLogin


router = APIRouter(
    prefix="/auth",
    tags=["Autenticación"]
)

# Aquí irán los endpoints como /auth/register, /auth/login


@router.post("/register")
async def register(user_data: UserCreate):
    try: 
        async with get_supabase_client() as client:
            # 1 ------ Crea un suario en Supabase Auth
            response = await client.post(f"{SUPABASE_URL}/auth/v1/signup", json={"email": user_data.email, "password": user_data.password})
            
            if response.status_code != 200:
                error_data = response.json()
                mensaje = error_data.get("error_description", error_data.get("msg", "Error al crear usuario"))
                return {"error": mensaje}
            
            user_data_AUTH = response.json()
            new_user_id = user_data_AUTH["user"]["id"]
            
            # 2 ------ Inserta el perfil extendido
            profile = {
                "id": new_user_id,
                "nombre": user_data.nombre,
                "email": user_data.email,
                "edad": user_data.edad,
                "peso_kg": user_data.peso,
                "altura_cm": int(user_data.altura),
                "genero": user_data.genero,
                "objetivos": user_data.objetivos,
                "restricciones": user_data.restricciones,
                "ingredientes_favoritos": user_data.ingredientes_favoritos,
            }
            
            # esto hara que se cree el perfil en supabase con los datos que se enviaron en el body de la peticion
            response = await client.post("/profiles", json=profile)
            if response.status_code != 201:
                return {"error": f"Perfil no creado. Detalle: {response.text}"}
            
            return {
                "id": new_user_id,
                "email": user_data_AUTH["user"]["email"],
                "nombre": user_data.nombre,
                "edad": user_data.edad,
                "peso_kg": user_data.peso,
                "altura_cm": int(user_data.altura),
                "genero": user_data.genero,
                "objetivos": user_data.objetivos,
                "restricciones": user_data.restricciones,
                "ingredientes_favoritos": user_data.ingredientes_favoritos,
            }
    except Exception as e:
        return {"error": str(e)}


@router.post("/login")
async def login(user_data: UserLogin):
    try: 
        async with get_supabase_client() as client:
            # 1 ------ Inicia sesion en Supabase Auth
            # Para el login de Supabase se necesita el query param ?grant_type=password
            response = await client.post(
                f"{SUPABASE_URL}/auth/v1/token?grant_type=password", 
                json={"email": user_data.email, "password": user_data.password}
            )
            
            if response.status_code != 200:
                # Si falla (ej: contraseña incorrecta)
                return {"error": response.json().get("error_description", "Error de autenticación")}
            
            user_data_AUTH = response.json()
            user_id = user_data_AUTH["user"]["id"]
            
            # 2 ------ Obtiene el perfil extendido desde la base de datos
            # Hacemos un GET a la tabla profiles donde el id sea igual al del usuario
            perfil_response = await client.get(f"/profiles?id=eq.{user_id}")
            
            # Obtenemos los datos (PostgREST devuelve una lista, tomamos el primer elemento)
            perfil_data = perfil_response.json()
            
            # Si no hay perfil por alguna razón, usamos un dict vacío o manejamos el error
            perfil = perfil_data[0] if len(perfil_data) > 0 else {}
            
            return {
                "access_token": user_data_AUTH["access_token"],
                "refresh_token": user_data_AUTH["refresh_token"],
                "user": {
                    "id": user_id,
                    "email": user_data_AUTH["user"]["email"],
                    "nombre": perfil.get("nombre", ""),
                    "edad": perfil.get("edad", 0),
                    "peso": perfil.get("peso_kg", 0.0),
                    "altura": perfil.get("altura_cm", 0.0),
                    "genero": perfil.get("genero", ""),
                    "objetivos": perfil.get("objetivos", []),
                    "restricciones": perfil.get("restricciones", []),
                    "ingredientes_favoritos": perfil.get("ingredientes_favoritos", [])
                }
            }
    except Exception as e:
        return {"error": str(e)}