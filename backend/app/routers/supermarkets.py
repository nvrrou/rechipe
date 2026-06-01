from fastapi import APIRouter
from app.dependencias import get_supabase_client

router = APIRouter(
    prefix="/supermarkets",
    tags=["Supermercados"]
)


SUPERMARKET_FIELDS = "id,nombre,cadena,direccion,latitud,longitud"


def _clean_payload(payload: dict) -> dict:
    return {key: value for key, value in payload.items() if value is not None}


async def guardar_precio_supermercado(
    client,
    producto_id: str,
    supermercado_id: str | None,
    precio: float | None,
    unidad: str | None,
    user_id: str | None = None,
):
    """
    Guarda o actualiza el precio de un producto en un supermercado.

    En la estructura actual de BD esta informacion vive en public.precios_productos,
    que relaciona producto_id con supermercado_id.
    """
    if not supermercado_id or precio is None:
        return None

    payload = _clean_payload({
        "producto_id": producto_id,
        "supermercado_id": supermercado_id,
        "user_id": user_id,
        "precio": precio,
        "unidad": unidad,
    })

    existing = await client.get(
        "/precios_productos",
        params={
            "producto_id": f"eq.{producto_id}",
            "supermercado_id": f"eq.{supermercado_id}",
            "select": "id",
            "limit": "1",
        },
    )
    if existing.status_code != 200:
        return {"error": f"No se pudo revisar el precio de supermercado. Detalle: {existing.text}"}

    if existing.json():
        response = await client.patch(
            f"/precios_productos?id=eq.{existing.json()[0]['id']}",
            json=payload,
        )
    else:
        response = await client.post("/precios_productos", json=payload)

    if response.status_code not in (200, 201, 204):
        return {"error": f"No se pudo guardar el precio de supermercado. Detalle: {response.text}"}

    return None


@router.get("")
@router.get("/")
@router.get("/listar")
async def listar_supermercados(q: str = ""):
    """Lista supermercados desde public.supermercados."""
    try:
        async with get_supabase_client() as client:
            params = {
                "select": SUPERMARKET_FIELDS,
                "order": "nombre.asc",
            }
            if q.strip():
                params["nombre"] = f"ilike.*{q.strip()}*"

            response = await client.get(
                "/supermercados",
                params=params,
            )
            if response.status_code != 200:
                return {
                    "items": [],
                    "error": f"Error al obtener supermercados. Detalle: {response.text}",
                }

            return {"items": response.json()}
    except Exception as e:
        return {"items": [], "error": str(e)}
