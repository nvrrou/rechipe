from app.config import SUPABASE_URL
from fastapi import APIRouter
from app.models.schemas import UserCreate, UserResponse, ProfileUpdate
from app.dependencias import get_supabase_client
from app.models.schemas import UserLogin, ResendVerification, CheckVerification


router = APIRouter(
    prefix="/auth",
    tags=["AutenticaciÃ³n"]
)

# AquÃ­ irÃ¡n los endpoints como /auth/register, /auth/login


@router.post("/register")
async def register(user_data: UserCreate):
    try:
        async with get_supabase_client() as client:
            # Crea un suario en Supabase Auth
            response = await client.post(f"{SUPABASE_URL}/auth/v1/signup", json={"email": user_data.email, "password": user_data.password})

            if response.status_code != 200:
                error_data = response.json()
                mensaje = error_data.get("error_description", error_data.get("msg", "Error al crear usuario"))
                return {"error": mensaje}

            user_data_AUTH = response.json()
            auth_user = user_data_AUTH.get("user") or user_data_AUTH.get("data", {}).get("user")
            if not isinstance(auth_user, dict) or not auth_user.get("id"):
                mensaje = (
                    user_data_AUTH.get("error_description")
                    or user_data_AUTH.get("msg")
                    or user_data_AUTH.get("message")
                    or "Supabase no devolvio el usuario creado"
                )
                return {"error": mensaje}

            new_user_id = auth_user["id"]

            # Inserta el perfil extendido
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
                "email": auth_user.get("email", user_data.email),
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
            # Inicia sesion en Supabase Auth
            # Para el login de Supabase se necesita el query param ?grant_type=password
            response = await client.post(
                f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
                json={"email": user_data.email, "password": user_data.password}
            )

            if response.status_code != 200:
                # Si falla (ej: contraseÃ±a incorrecta)
                return {"error": response.json().get("error_description", "Error de autenticaciÃ³n")}

            user_data_AUTH = response.json()
            user_id = user_data_AUTH["user"]["id"]

            # Hacemos un GET a la tabla profiles donde el id sea igual al del usuario
            perfil_response = await client.get(f"/profiles?id=eq.{user_id}")

            # Obtenemos los datos
            perfil_data = perfil_response.json()

            # Si no hay perfil por alguna razÃ³n, usamos un dict vacÃ­o o manejamos el error
            perfil = perfil_data[0] if len(perfil_data) > 0 else {}

            return {
                "access_token": user_data_AUTH["access_token"],
                "refresh_token": user_data_AUTH["refresh_token"],
                "user": {
                    "id": user_id,
                    "email": user_data_AUTH["user"]["email"],
                    "nombre": perfil.get("nombre") or "",
                    "edad": perfil.get("edad") or 0,
                    "peso": perfil.get("peso_kg") or 0.0,
                    "altura": int(perfil.get("altura_cm") or 0),
                    "genero": perfil.get("genero") or "",
                    "objetivos": perfil.get("objetivos") or [],
                    "restricciones": perfil.get("restricciones") or [],
                    "ingredientes_favoritos": perfil.get("ingredientes_favoritos") or []
                }
            }
    except Exception as e:
        return {"error": str(e)}


@router.post("/update_profile")
async def update_profile(profile_data: ProfileUpdate):
    try:
        async with get_supabase_client() as client:
            # Actualiza el perfil extendido
            profile_update_data = {
                "edad": profile_data.edad,
                "peso_kg": profile_data.peso,
                "altura_cm": int(profile_data.altura),
                "genero": profile_data.genero,
                "objetivos": profile_data.objetivos,
                "restricciones": profile_data.restricciones,
                "ingredientes_favoritos": profile_data.ingredientes_favoritos,
            }

            # Actualiza el perfil extendido
            response = await client.patch(f"/profiles?id=eq.{profile_data.user_id}", json=profile_update_data)

            if response.status_code not in (200, 204):
                return {"error": f"Error al actualizar el perfil. Detalle: {response.text}"}

            return {"msg": "Perfil actualizado exitosamente"}
    except Exception as e:
        return {"error": str(e)}


@router.post("/resend-verification")
async def resend_verification(data: ResendVerification):
    #REENVIA el correo de verificacion usando la API de Supabase Auth
    try:
        async with get_supabase_client() as client:
            response = await client.post(
                f"{SUPABASE_URL}/auth/v1/resend",
                json={
                    "type": "signup",
                    "email": data.email,
                }
            )

            if response.status_code == 200:
                return {"msg": "Correo de verificaciÃ³n reenviado exitosamente"}
            else:
                error_data = response.json()
                mensaje = error_data.get("error_description", error_data.get("msg", "Error al reenviar correo"))
                return {"error": mensaje}
    except Exception as e:
        return {"error": str(e)}


@router.post("/check-verification")
async def check_verification(data: CheckVerification):
    """Verifica si el email del usuario ya fue confirmado intentando un login"""
    try:
        async with get_supabase_client() as client:
            response = await client.post(
                f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
                json={"email": data.email, "password": data.password}
            )

            if response.status_code == 200:
                return {"verified": True}
            else:
                error_data = response.json()
                error_msg = error_data.get("error_description", error_data.get("msg", ""))

                # Si el error es por email no confirmado, indicamos que no estÃ¡ verificado
                if "email not confirmed" in error_msg.lower() or "email_not_confirmed" in error_msg.lower():
                    return {"verified": False, "error": "Email aÃºn no confirmado"}

                return {"verified": False, "error": error_msg}
    except Exception as e:
        return {"verified": False, "error": str(e)}
