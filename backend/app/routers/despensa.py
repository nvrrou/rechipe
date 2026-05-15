from fastapi import APIRouter
from app.models.schemas import DespensaAdd
from app.dependencias import get_supabase_client

router = APIRouter(
    prefix="/despensa",
    tags=["Despensa"]
)


@router.post("/agregar")
async def agregar_ingrediente(data: DespensaAdd):
    """Agrega un ingrediente a la despensa del usuario.
    Si el producto no existe en productos_catalogo, lo crea primero."""
    try:
        async with get_supabase_client() as client:
            # Buscar si el producto ya existe en el catalogo
            buscar = await client.get(
                f"/productos_catalogo?nombre=ilike.{data.nombre_producto}&select=id,nombre,categoria"
            )

            if buscar.status_code != 200:
                return {"error": f"Error al buscar producto. Detalle: {buscar.text}"}

            productos = buscar.json()

            if len(productos) > 0:
                producto_id = productos[0]["id"]
            else:
                # Si no existe, lo creamos en el catálogo
                nuevo_producto = {
                    "nombre": data.nombre_producto,
                    "categoria": data.categoria,
                }
                crear_resp = await client.post("/productos_catalogo", json=nuevo_producto)

                if crear_resp.status_code != 201:
                    return {"error": f"No se pudo crear el producto. Detalle: {crear_resp.text}"}

                producto_creado = crear_resp.json()
                producto_id = producto_creado[0]["id"]

            # Verificar que no este ya en la despensa del usuario
            ya_existe = await client.get(
                f"/despensa?user_id=eq.{data.user_id}&producto_id=eq.{producto_id}&select=id"
            )

            if ya_existe.status_code != 200:
                return {"error": f"Error al verificar despensa. Detalle: {ya_existe.text}"}

            if len(ya_existe.json()) > 0:
                return {"error": "Este ingrediente ya está en tu despensa"}

            # Insertar en la despensa
            item_despensa = {
                "user_id": data.user_id,
                "producto_id": producto_id,
                "cantidad": data.cantidad,
                "unidad": data.unidad,
            }
            insertar = await client.post("/despensa", json=item_despensa)

            if insertar.status_code != 201:
                return {"error": f"No se pudo agregar a la despensa. Detalle: {insertar.text}"}

            item = insertar.json()[0]
            return {
                "id": item["id"],
                "producto_id": producto_id,
                "nombre_producto": data.nombre_producto,
                "categoria": data.categoria,
                "cantidad": data.cantidad,
                "unidad": data.unidad,
                "created_at": item.get("created_at"),
            }
    except Exception as e:
        return {"error": str(e)}


@router.get("/listar/{user_id}")
async def listar_despensa(user_id: str):
    """Obtiene todos los ingredientes de la despensa del usuario con datos del producto."""
    try:
        async with get_supabase_client() as client:
            # Hacemos un select con join a productos_catalogo usando el query de Supabase
            response = await client.get(
                f"/despensa?user_id=eq.{user_id}&select=id,cantidad,unidad,created_at,producto_id,productos_catalogo(id,nombre,categoria)"
            )

            if response.status_code != 200:
                return {"error": f"Error al obtener la despensa. Detalle: {response.text}"}

            items_raw = response.json()
            items = []

            for item in items_raw:
                producto = item.get("productos_catalogo") or {}
                items.append({
                    "id": item["id"],
                    "producto_id": item["producto_id"],
                    "nombre_producto": producto.get("nombre", "Desconocido"),
                    "categoria": producto.get("categoria", "otros"),
                    "cantidad": item.get("cantidad"),
                    "unidad": item.get("unidad"),
                    "created_at": item.get("created_at"),
                })

            return {"items": items}
    except Exception as e:
        return {"error": str(e)}


@router.delete("/eliminar/{item_id}")
async def eliminar_ingrediente(item_id: str):
    """Elimina un ingrediente de la despensa."""
    try:
        async with get_supabase_client() as client:
            response = await client.delete(f"/despensa?id=eq.{item_id}")

            if response.status_code not in (200, 204):
                return {"error": f"No se pudo eliminar. Detalle: {response.text}"}

            return {"msg": "Ingrediente eliminado"}
    except Exception as e:
        return {"error": str(e)}


@router.get("/buscar/{user_id}")
async def buscar_ingredientes(user_id: str, q: str = ""):
    """Busca ingredientes en la despensa del usuario por nombre de producto."""
    try:
        async with get_supabase_client() as client:
            # Busca en despensa con filtro ilike en el nombre del producto relacionado
            response = await client.get(
                f"/despensa?user_id=eq.{user_id}&select=id,cantidad,unidad,created_at,producto_id,productos_catalogo(id,nombre,categoria)&productos_catalogo.nombre=ilike.*{q}*"
            )

            if response.status_code != 200:
                return {"error": f"Error en la búsqueda. Detalle: {response.text}"}

            items_raw = response.json()
            items = []

            for item in items_raw:
                producto = item.get("productos_catalogo") or {}
                # Solo incluir items donde el producto matchea (tiene datos)
                if producto.get("nombre"):
                    items.append({
                        "id": item["id"],
                        "producto_id": item["producto_id"],
                        "nombre_producto": producto.get("nombre", ""),
                        "categoria": producto.get("categoria", "otros"),
                        "cantidad": item.get("cantidad"),
                        "unidad": item.get("unidad"),
                        "created_at": item.get("created_at"),
                    })

            return {"items": items}
    except Exception as e:
        return {"error": str(e)}
