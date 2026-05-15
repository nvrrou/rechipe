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

class RecipeRequest(BaseModel):
    ingredientes: List[str]
    objetivo_nutricional: Optional[str] = ""