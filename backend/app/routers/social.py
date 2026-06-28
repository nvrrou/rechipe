from fastapi import APIRouter, Depends, HTTPException
import httpx
import json
import secrets
import string

from app.dependencias import get_supabase_client
from app.models.schemas import (
    GroupCreateRequest,
    GroupJoinRequest,
    GroupMemberAcceptedUpdateRequest,
    GroupRecipeRequest,
    GroupRoleUpdateRequest,
)
from app.routers.rechipes import (
    RECIPE_SELECT,
    _build_estimated_candidates,
    _db_recipe_to_generated,
    _find_purchase_candidates,
    _get_user_pantry,
    _merge_unique_text,
    _parse_preparation_minutes,
)
from app.services.ai_service import generar_pack_recetas_grupo_con_ia


router = APIRouter(
    prefix="/social",
    tags=["Social"],
)


MEMBER_TABLES = ("miembros_grupo", "grupo_miembros")
GROUP_CODE_FIELDS = ("codigo_grupo", "codigo_invitacion")
GROUP_CODE_ALPHABET = string.ascii_uppercase + string.digits
MEMBER_SELECT = "grupo_id,user_id,rol,accepted,joined_at"
MEMBER_SELECT_FALLBACK = "grupo_id,user_id,rol,joined_at"
GROUP_ROLES = ("admin", "editor", "espectador")


def _generate_group_code() -> str:
    return "".join(secrets.choice(GROUP_CODE_ALPHABET) for _ in range(6))


def _app_role(role: str | None) -> str:
    clean_role = str(role or "").lower()
    if clean_role == "admin":
        return "admin"
    if clean_role == "editor":
        return "editor"
    return "espectador"


def _db_role_for_table(table: str, role: str) -> str:
    return _app_role(role)


def _status_from_supabase(response: httpx.Response) -> int:
    return response.status_code if 400 <= response.status_code < 500 else 500


def _role_schema_hint(detail: str) -> str | None:
    normalized = detail.lower()
    role_error = "rol" in normalized and (
        "check constraint" in normalized
        or "violates check" in normalized
        or "23514" in normalized
        or "invalid input value" in normalized
    )
    if not role_error:
        return None
    return (
        "La base de datos todavia no acepta los roles editor/espectador. "
        "Ejecuta backend/sql/social_groups_roles.sql en Supabase y vuelve a intentar."
    )


def _can_edit(role: str | None) -> bool:
    return _app_role(role) in ("admin", "editor")


def _can_manage(role: str | None) -> bool:
    return _app_role(role) == "admin"


def _normalize_group(group: dict) -> dict:
    return {
        "id": group.get("id"),
        "nombre": group.get("nombre"),
        "creado_por": group.get("creado_por"),
        "codigo_grupo": group.get("codigo_grupo") or group.get("codigo_invitacion"),
        "created_at": group.get("created_at"),
    }


def _normalize_member(member: dict) -> dict:
    return {
        "grupo_id": member.get("grupo_id"),
        "user_id": member.get("user_id"),
        "rol": _app_role(member.get("rol")),
        "accepted": member.get("accepted") is not False,
        "joined_at": member.get("joined_at"),
    }


async def _select_groups(client: httpx.AsyncClient, params: dict):
    last_response = None
    for code_field in GROUP_CODE_FIELDS:
        response = await client.get(
            "/grupos",
            params={**params, "select": f"id,nombre,creado_por,{code_field},created_at"},
        )
        if response.status_code == 200:
            return [_normalize_group(group) for group in response.json()]
        last_response = response

    detail = last_response.text if last_response else "sin detalle"
    raise HTTPException(status_code=500, detail=f"No se pudieron leer grupos. Detalle: {detail}")


async def _find_group_by_code(client: httpx.AsyncClient, code: str):
    clean_code = code.strip().upper()
    if not clean_code:
        raise HTTPException(status_code=400, detail="Ingresa un codigo de grupo")

    for code_field in GROUP_CODE_FIELDS:
        response = await client.get(
            "/grupos",
            params={
                code_field: f"eq.{clean_code}",
                "select": f"id,nombre,creado_por,{code_field},created_at",
                "limit": "1",
            },
        )
        if response.status_code == 200 and response.json():
            return _normalize_group(response.json()[0])

    raise HTTPException(status_code=404, detail="No encontramos un grupo con ese codigo")


async def _create_group_record(client: httpx.AsyncClient, request: GroupCreateRequest):
    clean_name = request.nombre.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="El grupo necesita un nombre")

    last_response = None
    for code_field in GROUP_CODE_FIELDS:
        for _ in range(8):
            code = _generate_group_code()
            response = await client.post(
                "/grupos",
                json={
                    "nombre": clean_name,
                    "creado_por": request.user_id,
                    code_field: code,
                },
            )
            if response.status_code == 201:
                return _normalize_group(response.json()[0])
            last_response = response
            if response.status_code == 409:
                continue
            break

    detail = last_response.text if last_response else "sin detalle"
    raise HTTPException(status_code=500, detail=f"No se pudo crear el grupo. Detalle: {detail}")


async def _get_members(client: httpx.AsyncClient, params: dict):
    last_response = None
    for table in MEMBER_TABLES:
        response = await client.get(f"/{table}", params=params)
        if response.status_code == 200:
            return table, response.json()
        last_response = response

        if "accepted" in str(params.get("select") or ""):
            fallback_params = {
                **params,
                "select": str(params["select"]).replace("accepted,", "").replace(",accepted", ""),
            }
            response = await client.get(f"/{table}", params=fallback_params)
            if response.status_code == 200:
                return table, response.json()
            last_response = response

    detail = last_response.text if last_response else "sin detalle"
    raise HTTPException(status_code=500, detail=f"No se pudieron leer miembros. Detalle: {detail}")


async def _get_group_members(client: httpx.AsyncClient, group_id: str):
    _, members = await _get_members(
        client,
        {
            "grupo_id": f"eq.{group_id}",
            "select": MEMBER_SELECT,
            "order": "joined_at.asc",
        },
    )
    return [_normalize_member(member) for member in members]


async def _get_member(client: httpx.AsyncClient, group_id: str, user_id: str):
    table, members = await _get_members(
        client,
        {
            "grupo_id": f"eq.{group_id}",
            "user_id": f"eq.{user_id}",
            "select": MEMBER_SELECT,
            "limit": "1",
        },
    )
    return table, (_normalize_member(members[0]) if members else None)


async def _require_member(
    client: httpx.AsyncClient,
    group_id: str,
    user_id: str,
    require_accepted: bool = True,
):
    table, member = await _get_member(client, group_id, user_id)
    if not member:
        raise HTTPException(status_code=403, detail="No perteneces a este grupo")
    if require_accepted and not member["accepted"]:
        raise HTTPException(status_code=403, detail="Tu solicitud aun esta pendiente de aceptacion")
    return table, member


async def _insert_member(client: httpx.AsyncClient, group_id: str, user_id: str, role: str, accepted: bool):
    last_response = None
    for table in MEMBER_TABLES:
        response = await client.post(
            f"/{table}",
            json={
                "grupo_id": group_id,
                "user_id": user_id,
                "rol": _db_role_for_table(table, role),
                "accepted": accepted,
            },
        )
        if response.status_code == 201:
            return _normalize_member(response.json()[0])
        last_response = response

        response = await client.post(
            f"/{table}",
            json={
                "grupo_id": group_id,
                "user_id": user_id,
                "rol": _db_role_for_table(table, role),
            },
        )
        if response.status_code == 201:
            return _normalize_member(response.json()[0])
        last_response = response

    detail = last_response.text if last_response else "sin detalle"
    raise HTTPException(status_code=500, detail=f"No se pudo agregar el miembro. Detalle: {detail}")


async def _update_member_role(
    client: httpx.AsyncClient,
    table: str,
    group_id: str,
    user_id: str,
    role: str,
):
    response = await client.patch(
        f"/{table}?grupo_id=eq.{group_id}&user_id=eq.{user_id}",
        json={"rol": _db_role_for_table(table, role)},
    )
    if response.status_code not in (200, 204):
        schema_hint = _role_schema_hint(response.text)
        detail = schema_hint or f"No se pudo actualizar rol. Detalle: {response.text}"
        raise HTTPException(status_code=_status_from_supabase(response), detail=detail)


async def _update_member_accepted(
    client: httpx.AsyncClient,
    table: str,
    group_id: str,
    user_id: str,
    accepted: bool,
):
    response = await client.patch(
        f"/{table}?grupo_id=eq.{group_id}&user_id=eq.{user_id}",
        json={"accepted": accepted},
    )
    if response.status_code not in (200, 204):
        raise HTTPException(
            status_code=_status_from_supabase(response),
            detail=f"No se pudo actualizar solicitud. Detalle: {response.text}",
        )


async def _delete_member(client: httpx.AsyncClient, table: str, group_id: str, user_id: str):
    response = await client.delete(f"/{table}?grupo_id=eq.{group_id}&user_id=eq.{user_id}")
    if response.status_code not in (200, 204):
        raise HTTPException(
            status_code=_status_from_supabase(response),
            detail=f"No se pudo expulsar miembro. Detalle: {response.text}",
        )


async def _accepted_admin_count(client: httpx.AsyncClient, group_id: str) -> int:
    members = await _get_group_members(client, group_id)
    return sum(
        1
        for member in members
        if member["accepted"] and member["rol"] == "admin"
    )


async def _get_profiles_by_ids(client: httpx.AsyncClient, user_ids: list[str]):
    clean_ids = [user_id for user_id in user_ids if user_id]
    if not clean_ids:
        return {}

    response = await client.get(
        "/profiles",
        params={
            "id": f"in.({','.join(clean_ids)})",
            "select": "id,nombre,email,objetivos,restricciones,ingredientes_favoritos",
        },
    )
    if response.status_code != 200:
        raise HTTPException(status_code=500, detail=f"No se pudieron leer perfiles. Detalle: {response.text}")

    return {profile["id"]: profile for profile in response.json()}


async def _build_group_detail(client: httpx.AsyncClient, group_id: str, user_id: str):
    _, requester_member = await _require_member(client, group_id, user_id)
    groups = await _select_groups(client, {"id": f"eq.{group_id}", "limit": "1"})
    if not groups:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")

    members = await _get_group_members(client, group_id)
    if not _can_manage(requester_member["rol"]):
        members = [member for member in members if member["accepted"]]

    profiles_by_id = await _get_profiles_by_ids(client, [member["user_id"] for member in members])
    formatted_members = []

    for member in members:
        profile = profiles_by_id.get(member["user_id"], {})
        formatted_members.append({
            **member,
            "nombre": profile.get("nombre") or profile.get("email") or "Integrante",
            "email": profile.get("email"),
            "objetivos": profile.get("objetivos") if isinstance(profile.get("objetivos"), list) else [],
            "restricciones": profile.get("restricciones") if isinstance(profile.get("restricciones"), list) else [],
            "ingredientes_favoritos": (
                profile.get("ingredientes_favoritos")
                if isinstance(profile.get("ingredientes_favoritos"), list)
                else []
            ),
        })

    current_member = next((member for member in members if member["user_id"] == user_id), None)
    return {
        "grupo": groups[0],
        "miembros": formatted_members,
        "mi_rol": current_member["rol"] if current_member else requester_member["rol"],
    }


def _format_pantry_items(pantry_items: list[dict]):
    ingredientes = []
    for item in pantry_items:
        product = item.get("producto")
        if not product:
            continue
        ingredientes.append(
            f"- {item.get('cantidad') or ''} {item.get('unidad') or ''} de {product.get('nombre')} "
            f"(Info base por 100g: {product.get('energia_kcal') or 0} kcal, "
            f"{product.get('proteinas_g') or 0}g Prot, {product.get('carbohidratos_g') or 0}g Carb, "
            f"{product.get('grasas_totales_g') or 0}g Grasas)"
        )
    return ingredientes


async def _build_budget_options(client: httpx.AsyncClient, pantry_items: list[dict], presupuesto: float):
    pantry_names = {
        (item["producto"].get("nombre") or "").lower()
        for item in pantry_items
        if item.get("producto")
    }
    db_candidates = await _find_purchase_candidates(client, pantry_names)
    estimated_candidates = []
    if len(db_candidates) < 5:
        used_names = pantry_names.union({
            candidate["nombre"].lower()
            for candidate in db_candidates
            if candidate.get("nombre")
        })
        estimated_candidates = await _build_estimated_candidates(used_names, 6 - len(db_candidates))

    all_candidates = [*db_candidates, *estimated_candidates]
    affordable_candidates = [
        candidate
        for candidate in all_candidates
        if float(candidate.get("precio") or 0) <= presupuesto
    ][:8]

    if not affordable_candidates:
        affordable_candidates = sorted(all_candidates, key=lambda item: item.get("precio") or 0)[:4]

    compras_posibles = [
        f"- {item['nombre']} ({item['cantidad']}): CLP {int(item.get('precio') or 0)}. {item.get('reason') or ''}"
        for item in affordable_candidates
    ]
    return compras_posibles, affordable_candidates


def _recipe_to_group_payload(
    receta: dict,
    group_id: str,
    user_id: str,
    tipo_comida: str,
    presupuestada: bool,
):
    pasos = receta.get("pasos") or []
    ingredientes = receta.get("ingredientes") or []
    macros = receta.get("macros_totales") or {}
    metadata = {
        "grupo_id": group_id,
        "tipo": "social_pack",
        "tipo_comida": tipo_comida,
        "persona_id": receta.get("persona_id"),
        "persona_nombre": receta.get("persona_nombre"),
        "ingrediente_comun": receta.get("ingrediente_comun"),
        "presupuestada": presupuestada,
        "compras_usadas": receta.get("compras_usadas") or [],
    }

    return {
        "creado_por": user_id,
        "grupo_id": group_id,
        "titulo": receta.get("titulo") or "Receta grupal",
        "descripcion": receta.get("por_que_funciona") or tipo_comida,
        "instrucciones": "\n".join(str(step) for step in pasos) if isinstance(pasos, list) else str(pasos or ""),
        "ingredientes": ingredientes if isinstance(ingredientes, list) else [str(ingredientes)],
        "info_nutricional": macros if isinstance(macros, dict) else {},
        "tiempo_preparacion": _parse_preparation_minutes(receta.get("tiempo_preparacion")),
        "porciones": receta.get("porciones") or 1,
        "costo_estimado": receta.get("costo_estimado"),
        "es_publica": False,
        "generada_por_ia": True,
        "prompt_usado": json.dumps(metadata, ensure_ascii=False),
    }


async def _save_group_recipes(
    client: httpx.AsyncClient,
    group_id: str,
    user_id: str,
    tipo_comida: str,
    recipes: list[dict],
    presupuestada: bool,
):
    saved_items = []
    for recipe in recipes:
        payload = _recipe_to_group_payload(recipe, group_id, user_id, tipo_comida, presupuestada)
        response = await client.post("/recetas", json=payload)
        if response.status_code != 201:
            raise HTTPException(status_code=500, detail=f"No se pudo guardar receta grupal. Detalle: {response.text}")
        saved = _db_recipe_to_generated(response.json()[0])
        saved_items.append(saved)
    return saved_items


async def _generate_group_recipes(
    group_id: str,
    request: GroupRecipeRequest,
    client: httpx.AsyncClient,
    force_budget: bool = False,
):
    _, actor_member = await _require_member(client, group_id, request.user_id)
    if not _can_edit(actor_member["rol"]):
        raise HTTPException(status_code=403, detail="Tu rol actual solo permite ver este grupo")

    detail = await _build_group_detail(client, group_id, request.user_id)
    members_context = [
        {
            "persona_id": member["user_id"],
            "persona_nombre": member["nombre"],
            "rol": member["rol"],
            "objetivos": member["objetivos"],
            "restricciones": member["restricciones"],
            "ingredientes_favoritos": member["ingredientes_favoritos"],
        }
        for member in detail["miembros"]
        if member.get("accepted") is not False
    ]

    pantry_items = await _get_user_pantry(client, request.user_id)
    if not pantry_items:
        raise HTTPException(status_code=400, detail="Tu despensa esta vacia")

    presupuestada = force_budget or request.presupuestada
    compras_posibles = []
    compras_sugeridas = []
    presupuesto = float(request.presupuesto or 0)

    if presupuestada:
        if presupuesto <= 0:
            raise HTTPException(status_code=400, detail="El presupuesto debe ser mayor a 0")
        compras_posibles, compras_sugeridas = await _build_budget_options(client, pantry_items, presupuesto)

    restricciones_extra = _merge_unique_text(request.restricciones or [])
    recipe_pack = await generar_pack_recetas_grupo_con_ia(
        ingredientes_despensa=_format_pantry_items(pantry_items),
        miembros=members_context,
        objetivo_nutricional=request.objetivo_nutricional or "",
        tipo_comida=request.tipo_comida,
        ingredientes_obligatorios=request.ingredientes,
        restricciones_alimentarias=restricciones_extra,
        presupuestada=presupuestada,
        presupuesto=presupuesto if presupuestada else None,
        compras_posibles=compras_posibles,
    )

    if "error" in recipe_pack:
        return recipe_pack

    recipes = recipe_pack.get("recetas") or []
    saved_recipes = await _save_group_recipes(
        client,
        group_id,
        request.user_id,
        request.tipo_comida,
        recipes,
        presupuestada,
    )

    return {
        "grupo_id": group_id,
        "recetas": saved_recipes,
        "compras_sugeridas": recipe_pack.get("compras_sugeridas") or compras_sugeridas,
        "costo_total": recipe_pack.get("costo_total"),
    }


@router.post("/grupos")
async def crear_grupo(
    request: GroupCreateRequest,
    client: httpx.AsyncClient = Depends(get_supabase_client),
):
    try:
        group = await _create_group_record(client, request)
        member = await _insert_member(client, group["id"], request.user_id, "admin", accepted=True)
        return {"grupo": group, "miembro": member}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/grupos/unirse")
async def unirse_a_grupo(
    request: GroupJoinRequest,
    client: httpx.AsyncClient = Depends(get_supabase_client),
):
    try:
        group = await _find_group_by_code(client, request.codigo_grupo)
        _, existing_member = await _get_member(client, group["id"], request.user_id)
        if existing_member:
            return {"grupo": group, "miembro": existing_member, "ya_estaba": True}
        member = await _insert_member(client, group["id"], request.user_id, "espectador", accepted=False)
        return {"grupo": group, "miembro": member}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/grupos/{user_id}")
async def listar_grupos_usuario(user_id: str, client: httpx.AsyncClient = Depends(get_supabase_client)):
    try:
        _, members = await _get_members(
            client,
            {
                "user_id": f"eq.{user_id}",
                "select": MEMBER_SELECT,
                "order": "joined_at.desc",
            },
        )
        normalized_members = [_normalize_member(member) for member in members]
        group_ids = [member["grupo_id"] for member in normalized_members if member.get("grupo_id")]
        if not group_ids:
            return {"items": []}

        groups = await _select_groups(client, {"id": f"in.({','.join(group_ids)})"})
        members_by_group = {member["grupo_id"]: member for member in normalized_members}
        return {
            "items": [
                {
                    **group,
                    "mi_rol": members_by_group.get(group["id"], {}).get("rol", "espectador"),
                    "accepted": members_by_group.get(group["id"], {}).get("accepted", True),
                }
                for group in groups
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/grupos/{group_id}/detalle")
async def obtener_detalle_grupo(
    group_id: str,
    user_id: str,
    client: httpx.AsyncClient = Depends(get_supabase_client),
):
    try:
        return await _build_group_detail(client, group_id, user_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/grupos/{group_id}/miembros/{member_user_id}")
async def cambiar_rol_miembro(
    group_id: str,
    member_user_id: str,
    request: GroupRoleUpdateRequest,
    client: httpx.AsyncClient = Depends(get_supabase_client),
):
    try:
        clean_role = str(request.rol or "").lower()
        if clean_role not in GROUP_ROLES:
            raise HTTPException(status_code=400, detail="Rol invalido")

        _, actor_member = await _require_member(client, group_id, request.actor_user_id)
        if not _can_manage(actor_member["rol"]):
            raise HTTPException(status_code=403, detail="Solo admins pueden cambiar roles")

        target_table, target_member = await _require_member(client, group_id, member_user_id)
        if target_member["rol"] == "admin" and clean_role != "admin":
            admin_count = await _accepted_admin_count(client, group_id)
            if admin_count <= 1:
                raise HTTPException(status_code=400, detail="El grupo debe mantener al menos un admin")
        await _update_member_role(client, target_table, group_id, member_user_id, clean_role)
        return {"ok": True, "rol": _app_role(request.rol)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/grupos/{group_id}/miembros/{member_user_id}/accepted")
async def cambiar_aceptacion_miembro(
    group_id: str,
    member_user_id: str,
    request: GroupMemberAcceptedUpdateRequest,
    client: httpx.AsyncClient = Depends(get_supabase_client),
):
    try:
        _, actor_member = await _require_member(client, group_id, request.actor_user_id)
        if not _can_manage(actor_member["rol"]):
            raise HTTPException(status_code=403, detail="Solo admins pueden revisar solicitudes")

        target_table, _ = await _require_member(client, group_id, member_user_id, require_accepted=False)
        await _update_member_accepted(client, target_table, group_id, member_user_id, request.accepted)
        return {"ok": True, "accepted": request.accepted}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/grupos/{group_id}/miembros/{member_user_id}")
async def expulsar_miembro(
    group_id: str,
    member_user_id: str,
    actor_user_id: str,
    client: httpx.AsyncClient = Depends(get_supabase_client),
):
    try:
        _, actor_member = await _require_member(client, group_id, actor_user_id)
        if not _can_manage(actor_member["rol"]):
            raise HTTPException(status_code=403, detail="Solo admins pueden expulsar miembros")
        if actor_user_id == member_user_id:
            raise HTTPException(status_code=400, detail="No puedes expulsarte a ti mismo")

        target_table, target_member = await _require_member(client, group_id, member_user_id, require_accepted=False)
        if target_member["rol"] == "admin" and target_member["accepted"]:
            admin_count = await _accepted_admin_count(client, group_id)
            if admin_count <= 1:
                raise HTTPException(status_code=400, detail="El grupo debe mantener al menos un admin")

        await _delete_member(client, target_table, group_id, member_user_id)
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/grupos/{group_id}/recetas/generar")
async def generar_recetas_grupales(
    group_id: str,
    request: GroupRecipeRequest,
    client: httpx.AsyncClient = Depends(get_supabase_client),
):
    try:
        return await _generate_group_recipes(group_id, request, client)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/grupos/{group_id}/recetas/generar-presupuestada")
async def generar_recetas_grupales_presupuestadas(
    group_id: str,
    request: GroupRecipeRequest,
    client: httpx.AsyncClient = Depends(get_supabase_client),
):
    try:
        return await _generate_group_recipes(group_id, request, client, force_budget=True)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/grupos/{group_id}/recetas")
async def listar_recetas_grupales(
    group_id: str,
    user_id: str,
    limit: int = 30,
    client: httpx.AsyncClient = Depends(get_supabase_client),
):
    try:
        await _require_member(client, group_id, user_id)
        clean_limit = max(1, min(limit, 80))
        response = await client.get(
            "/recetas",
            params={
                "grupo_id": f"eq.{group_id}",
                "select": RECIPE_SELECT,
                "order": "created_at.desc",
                "limit": str(clean_limit),
            },
        )
        if response.status_code != 200:
            return {"items": [], "error": f"Error al obtener historial grupal. Detalle: {response.text}"}
        return {"items": [_db_recipe_to_generated(recipe) for recipe in response.json()]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
