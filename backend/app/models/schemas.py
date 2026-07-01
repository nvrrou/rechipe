import pydantic
from pydantic import BaseModel
from typing import Any, List, Optional

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


class ResendVerification(pydantic.BaseModel):
    email: str


class CheckVerification(pydantic.BaseModel):
    email: str
    password: str


#IA
class RecipeRequest(BaseModel):
    user_id: str         # El ID del usuario en Supabase (UUID)
    tipo_comida: str     # Ej: "desayuno", "almuerzo", "cena"
    ingredientes: List[str] = []         # Lista de nombres de ingredientes obligatorios
    objetivo_nutricional: Optional[str] = "" # El objetivo que manda el frontend
    restricciones: List[str] = []
    usar_restricciones_perfil: bool = True


class BudgetRecipeRequest(BaseModel):
    user_id: str
    tipo_comida: str
    presupuesto: float
    ingredientes: List[str] = []
    objetivo_nutricional: Optional[str] = ""
    restricciones: List[str] = []
    usar_restricciones_perfil: bool = True


class BudgetUpsertRequest(BaseModel):
    user_id: str
    monto: float
    periodo: str = "mensual"
    moneda: str = "CLP"


class BudgetSpendRequest(BaseModel):
    user_id: str
    monto: float
    descripcion: Optional[str] = ""


class WeeklyPlanRequest(BaseModel):
    user_id: str
    presupuesto: Optional[float] = None
    preferencias_semana: Optional[str] = ""
    permitir_comidas_intermedias: bool = False
    dias: int = 7
    comidas_por_dia: int = 3
    usar_presupuesto_perfil: bool = True


class WeeklyMealRecipeUpdateRequest(BaseModel):
    user_id: str
    receta: dict[str, Any]


class RecipeAdjustRequest(BaseModel):
    receta: dict[str, Any]
    cambios: str
    restricciones: List[str] = []
    compras_sugeridas: List[dict[str, Any]] = []


class RecipeHistorySaveRequest(BaseModel):
    user_id: str
    receta: dict[str, Any]
    tipo_comida: Optional[str] = ""
    prompt_usado: Optional[str] = ""
    costo_estimado: Optional[float] = None


class RecipePrepareRequest(BaseModel):
    user_id: str
    receta: dict[str, Any]


class GroupCreateRequest(BaseModel):
    user_id: str
    nombre: str


class GroupJoinRequest(BaseModel):
    user_id: str
    codigo_grupo: str


class GroupRoleUpdateRequest(BaseModel):
    actor_user_id: str
    rol: str


class GroupMemberAcceptedUpdateRequest(BaseModel):
    actor_user_id: str
    accepted: bool


class GroupRecipeRequest(BaseModel):
    user_id: str
    tipo_comida: str
    ingredientes: List[str] = []
    objetivo_nutricional: Optional[str] = ""
    restricciones: List[str] = []
    usar_restricciones_perfil: bool = True
    presupuestada: bool = False
    presupuesto: Optional[float] = None


class EsquemaAlimento(BaseModel):
    nombre: str


class CategoriaProductoCheck(BaseModel):
    nombre_producto: str
    categoria_actual: str
    categorias_disponibles: list[str]

# DESPENSA

class DespensaAdd(pydantic.BaseModel):
    user_id: str
    producto_catalogo_id: str | None = None
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
    cantidad_precio: float | None = None
    unidad_precio: str | None = None
    supermercado_id: str | None = None
    precio_supermercado: float | None = None
    precio_unidad: str | None = None
    fecha_vencimiento: str | None = None
    generar_info_ia: bool = False
    generar_imagen_ia: bool = False


class DespensaBarcodeAdd(pydantic.BaseModel):
    user_id: str
    codigo_barra: str
    categorias_disponibles: list[str] = pydantic.Field(default_factory=list)
    usar_ia: bool = False
    cantidad: float | None = None
    unidad: str | None = None
    precio_aprox: float | None = None
    cantidad_precio: float | None = None
    unidad_precio: str | None = None
    supermercado_id: str | None = None
    precio_supermercado: float | None = None
    precio_unidad: str | None = None
    fecha_vencimiento: str | None = None
    generar_imagen_ia: bool = False


class DespensaUpdate(pydantic.BaseModel):
    producto_catalogo_id: str | None = None
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
    cantidad_precio: float | None = None
    unidad_precio: str | None = None
    supermercado_id: str | None = None
    precio_supermercado: float | None = None
    precio_unidad: str | None = None
    fecha_vencimiento: str | None = None
    generar_info_ia: bool = False
    generar_imagen_ia: bool = False

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
    cantidad_precio: float | None = None
    unidad_precio: str | None = None
    supermercado_id: str | None = None
    precio_supermercado: float | None = None
    precio_unidad: str | None = None
    fecha_vencimiento: str | None = None
    created_at: str | None = None
