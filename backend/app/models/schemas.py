import pydantic
from pydantic import BaseModel
from typing import List, Optional

class UserCreate(pydantic.BaseModel):
    email: str
    password: str
    nombre: str
    edad: int
    peso: float
    altura: float
    genero: str
    objetivos: list[str]
    restricciones: list[str]
    ingredientes_favoritos: list[str]

class UserUpdate(pydantic.BaseModel):
    nombre: str
    edad: int
    peso: float
    altura: float
    genero: str
    objetivos: list[str]
    restricciones: list[str]
    ingredientes_favoritos: list[str]

class ProfileUpdate(pydantic.BaseModel):
    user_id: str
    edad: int
    peso: float
    altura: float
    genero: str
    objetivos: list[str]
    restricciones: list[str]
    ingredientes_favoritos: list[str]

class UserResponse(pydantic.BaseModel):
    id: str
    email: str
    nombre: str
    edad: int
    peso: float
    altura: float
    genero: str
    objetivos: list[str]
    restricciones: list[str]
    ingredientes_favoritos: list[str]


class TokenResponse(pydantic.BaseModel):
    access_token: str
    refresh_token: str
    user: UserResponse


class UserLogin(pydantic.BaseModel):
    email: str
    password: str


#IA
class RecipeRequest(BaseModel):
    ingredientes: List[str]
    objetivo_nutricional: Optional[str] = ""

class EsquemaAlimento(BaseModel):
    nombre: str

# DESPENSA

class DespensaAdd(pydantic.BaseModel):
    user_id: str
    nombre_producto: str
    categoria: str
    codigo_barra: str | None = None
    marca: str | None = None
    imagen_url: str | None = None
    energia_kcal: float | None = None
    proteinas_g: float | None = None
    carbohidratos_g: float | None = None
    grasas_g: float | None = None
    fibra_g: float | None = None
    sodio_mg: float | None = None
    azucar_g: float | None = None
    cantidad: float | None = None
    unidad: str | None = None
    precio_aprox: float | None = None
    fecha_vencimiento: str | None = None


class DespensaUpdate(pydantic.BaseModel):
    nombre_producto: str | None = None
    categoria: str | None = None
    codigo_barra: str | None = None
    marca: str | None = None
    imagen_url: str | None = None
    energia_kcal: float | None = None
    proteinas_g: float | None = None
    carbohidratos_g: float | None = None
    grasas_g: float | None = None
    fibra_g: float | None = None
    sodio_mg: float | None = None
    azucar_g: float | None = None
    cantidad: float | None = None
    unidad: str | None = None
    precio_aprox: float | None = None
    fecha_vencimiento: str | None = None

class DespensaItem(pydantic.BaseModel):
    id: str
    producto_id: str
    nombre_producto: str
    categoria: str
    codigo_barra: str | None = None
    marca: str | None = None
    imagen_url: str | None = None
    energia_kcal: float | None = None
    proteinas_g: float | None = None
    carbohidratos_g: float | None = None
    grasas_g: float | None = None
    fibra_g: float | None = None
    sodio_mg: float | None = None
    azucar_g: float | None = None
    cantidad: float | None = None
    unidad: str | None = None
    precio_aprox: float | None = None
    fecha_vencimiento: str | None = None
    created_at: str | None = None
