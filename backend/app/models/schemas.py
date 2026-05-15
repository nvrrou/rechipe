import pydantic

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


# DESPENSA

class DespensaAdd(pydantic.BaseModel):
    user_id: str
    nombre_producto: str
    categoria: str
    cantidad: float | None = None
    unidad: str | None = None

class DespensaItem(pydantic.BaseModel):
    id: str
    producto_id: str
    nombre_producto: str
    categoria: str
    cantidad: float | None = None
    unidad: str | None = None
    created_at: str | None = None
