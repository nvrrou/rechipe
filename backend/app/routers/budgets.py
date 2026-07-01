from datetime import date, datetime, timedelta, timezone
import json
import re

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.dependencias import get_supabase_client
from app.models.schemas import BudgetSpendRequest, BudgetUpsertRequest, WeeklyMealRecipeUpdateRequest, WeeklyPlanRequest
from app.services.ai_service import generar_plan_semanal_con_ia

router = APIRouter(prefix="/budgets", tags=["Presupuestos"])

BUDGET_FIELDS = "id,user_id,monto,periodo,moneda,gastado,created_at,updated_at"
RECIPE_FIELDS = "id,creado_por,grupo_id,titulo,descripcion,instrucciones,ingredientes,info_nutricional,tiempo_preparacion,porciones,costo_estimado,es_publica,generada_por_ia,prompt_usado,created_at,updated_at"
DAY_NAMES = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"]


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _week_start_iso():
    today = date.today()
    return (today - timedelta(days=today.weekday())).isoformat()


def _parse_preparation_minutes(value) -> int | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return int(value)
    match = re.search(r"\d+", str(value))
    return int(match.group(0)) if match else None


def _recipe_payload_from_weekly_meal(user_id: str, meal: dict, day_name: str, meal_type: str):
    steps = meal.get("pasos") or []
    instructions = "\n".join(str(step) for step in steps) if isinstance(steps, list) else str(steps or "")
    ingredients = meal.get("ingredientes") or []
    reason = meal.get("por_que") or meal.get("por_que_funciona")
    metadata = {
        "source": "weekly_plan",
        "dia": day_name,
        "tipo_comida": meal_type,
        "por_que": reason,
        "compras_usadas": meal.get("compras_usadas") or [],
    }
    nutrition = meal.get("macros_totales")
    if not isinstance(nutrition, dict):
        nutrition = {}

    return {
        "creado_por": user_id,
        "titulo": meal.get("titulo") or "Receta semanal",
        "descripcion": reason or f"{day_name} - {meal_type}",
        "instrucciones": instructions,
        "ingredientes": ingredients if isinstance(ingredients, list) else [str(ingredients)],
        "info_nutricional": nutrition,
        "tiempo_preparacion": _parse_preparation_minutes(meal.get("tiempo_preparacion")),
        "porciones": meal.get("porciones") or 1,
        "costo_estimado": meal.get("costo_estimado"),
        "es_publica": False,
        "generada_por_ia": True,
        "prompt_usado": json.dumps(metadata, ensure_ascii=False),
        "updated_at": _now_iso(),
    }


def _db_recipe_to_weekly_meal(recipe: dict, meal_row: dict, day_name: str):
    steps = [
        step.strip()
        for step in (recipe.get("instrucciones") or "").split("\n")
        if step.strip()
    ]
    metadata = {}
    prompt_used = recipe.get("prompt_usado") or ""
    if isinstance(prompt_used, str) and prompt_used.strip().startswith("{"):
        try:
            metadata = json.loads(prompt_used)
        except json.JSONDecodeError:
            metadata = {}

    minutes = recipe.get("tiempo_preparacion")
    return {
        "id": meal_row.get("id"),
        "plan_id": meal_row.get("plan_id"),
        "recipe_id": recipe.get("id"),
        "dia_semana": meal_row.get("dia_semana"),
        "tipo": meal_row.get("tipo_comida") or metadata.get("tipo_comida") or "Comida",
        "titulo": recipe.get("titulo") or "Receta semanal",
        "ingredientes": recipe.get("ingredientes") or [],
        "pasos": steps,
        "tiempo_preparacion": f"{minutes} min" if minutes else None,
        "macros_totales": recipe.get("info_nutricional") or {},
        "costo_estimado": recipe.get("costo_estimado") or 0,
        "por_que": recipe.get("descripcion") or metadata.get("por_que"),
        "created_at": recipe.get("created_at"),
    }


def _weekly_recipe_to_generated(recipe: dict, meal: dict):
    return {
        "id": recipe.get("id"),
        "titulo": recipe.get("titulo"),
        "tiempo_preparacion": meal.get("tiempo_preparacion"),
        "por_que_funciona": recipe.get("descripcion"),
        "macros_totales": recipe.get("info_nutricional") or {},
        "ingredientes": recipe.get("ingredientes") or [],
        "pasos": meal.get("pasos") or [],
        "created_at": recipe.get("created_at"),
        "costo_estimado": recipe.get("costo_estimado"),
    }


def _normalize_weekly_plan_macros(plan: dict):
    for day in plan.get("dias") or []:
        calories = 0.0
        protein = 0.0
        carbs = 0.0
        fats = 0.0
        for meal in day.get("comidas") or []:
            macros = meal.get("macros_totales")
            if not isinstance(macros, dict):
                macros = {}
                meal["macros_totales"] = macros
            calories += float(macros.get("calorias") or 0)
            protein += float(macros.get("proteinas") or 0)
            carbs += float(macros.get("carbohidratos") or 0)
            fats += float(macros.get("grasas") or 0)

        day["calorias_estimadas"] = calories
        day["proteinas_g"] = protein
        day["carbohidratos_g"] = carbs
        day["grasas_g"] = fats
    return plan


async def _get_budget(client: httpx.AsyncClient, user_id: str):
    response = await client.get(
        "/presupuestos",
        params={
            "user_id": f"eq.{user_id}",
            "select": BUDGET_FIELDS,
            "order": "created_at.desc",
            "limit": "1",
        },
    )
    if response.status_code != 200:
        raise HTTPException(status_code=500, detail=f"No se pudo leer presupuesto. Detalle: {response.text}")
    items = response.json()
    return items[0] if items else None


async def _get_user_context(client: httpx.AsyncClient, user_id: str):
    profile_response = await client.get(
        "/profiles",
        params={
            "id": f"eq.{user_id}",
            "select": "objetivos,restricciones,ingredientes_favoritos,edad,peso_kg,altura_cm,genero",
            "limit": "1",
        },
    )
    profile_response.raise_for_status()
    profile = profile_response.json()[0] if profile_response.json() else {}
    return {
        "objetivos": profile.get("objetivos") if isinstance(profile.get("objetivos"), list) else [],
        "restricciones": profile.get("restricciones") if isinstance(profile.get("restricciones"), list) else [],
        "ingredientes_favoritos": profile.get("ingredientes_favoritos") if isinstance(profile.get("ingredientes_favoritos"), list) else [],
        "edad": profile.get("edad") or 0,
        "peso_kg": profile.get("peso_kg") or 0,
        "altura_cm": profile.get("altura_cm") or 0,
        "genero": profile.get("genero") or "",
    }


async def _get_pantry_lines(client: httpx.AsyncClient, user_id: str):
    response = await client.get(
        "/despensa",
        params={
            "user_id": f"eq.{user_id}",
            "select": "cantidad,unidad,productos(nombre,categoria,energia_kcal,proteinas_g,carbohidratos_g,grasas_totales_g)",
        },
    )
    response.raise_for_status()
    lines = []
    for item in response.json():
        product = item.get("productos") or {}
        if product.get("nombre"):
            lines.append(
                f"- {item.get('cantidad') or ''} {item.get('unidad') or ''} de {product.get('nombre')} "
                f"({product.get('categoria') or 'otros'}, {product.get('energia_kcal') or 0} kcal/100g)"
            )
    return lines


async def _persist_weekly_plan(client: httpx.AsyncClient, user_id: str, plan: dict, budget: dict | None):
    plan_response = await client.post(
        "/planes_semanales",
        json={
            "user_id": user_id,
            "nombre": "Plan semanal IA",
            "semana_inicio": _week_start_iso(),
            "presupuesto_id": budget.get("id") if budget else None,
            "updated_at": _now_iso(),
        },
    )
    if plan_response.status_code != 201:
        raise HTTPException(status_code=500, detail=f"No se pudo guardar plan semanal. Detalle: {plan_response.text}")

    saved_plan = plan_response.json()[0]
    plan["id"] = saved_plan.get("id")
    plan["semana_inicio"] = saved_plan.get("semana_inicio")

    for day_index, day_item in enumerate(plan.get("dias") or [], start=1):
        day_name = day_item.get("dia") or DAY_NAMES[min(day_index - 1, 6)]
        for meal_item in day_item.get("comidas") or []:
            meal_type = meal_item.get("tipo") or "Comida"
            recipe_response = await client.post(
                "/recetas",
                json=_recipe_payload_from_weekly_meal(user_id, meal_item, day_name, meal_type),
            )
            if recipe_response.status_code != 201:
                raise HTTPException(status_code=500, detail=f"No se pudo guardar receta semanal. Detalle: {recipe_response.text}")

            saved_recipe = recipe_response.json()[0]
            meal_response = await client.post(
                "/plan_comidas",
                json={
                    "plan_id": saved_plan.get("id"),
                    "receta_id": saved_recipe.get("id"),
                    "dia_semana": max(1, min(day_index, 7)),
                    "tipo_comida": meal_type,
                    "porciones": meal_item.get("porciones") or 1,
                },
            )
            if meal_response.status_code != 201:
                raise HTTPException(status_code=500, detail=f"No se pudo guardar comida semanal. Detalle: {meal_response.text}")

            saved_meal = meal_response.json()[0]
            meal_item["id"] = saved_meal.get("id")
            meal_item["plan_id"] = saved_plan.get("id")
            meal_item["recipe_id"] = saved_recipe.get("id")
            meal_item["dia_semana"] = max(1, min(day_index, 7))

    return plan


async def _load_weekly_plan(client: httpx.AsyncClient, user_id: str, plan_id: str | None = None):
    plan_params = {
        "user_id": f"eq.{user_id}",
        "select": "id,user_id,grupo_id,nombre,semana_inicio,presupuesto_id,created_at,updated_at",
        "order": "created_at.desc",
        "limit": "1",
    }
    if plan_id:
        plan_params["id"] = f"eq.{plan_id}"

    plan_response = await client.get("/planes_semanales", params=plan_params)
    if plan_response.status_code != 200:
        raise HTTPException(status_code=500, detail=f"No se pudo leer plan semanal. Detalle: {plan_response.text}")
    plans = plan_response.json()
    if not plans:
        return None

    plan_row = plans[0]
    meals_response = await client.get(
        "/plan_comidas",
        params={
            "plan_id": f"eq.{plan_row['id']}",
            "select": "id,plan_id,receta_id,dia_semana,tipo_comida,porciones,created_at",
            "order": "dia_semana.asc",
        },
    )
    if meals_response.status_code != 200:
        raise HTTPException(status_code=500, detail=f"No se pudo leer comidas del plan. Detalle: {meals_response.text}")

    meal_rows = meals_response.json()
    recipe_ids = [row.get("receta_id") for row in meal_rows if row.get("receta_id")]
    recipes_by_id = {}
    if recipe_ids:
        recipes_response = await client.get(
            "/recetas",
            params={
                "id": f"in.({','.join(recipe_ids)})",
                "select": RECIPE_FIELDS,
            },
        )
        if recipes_response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"No se pudo leer recetas del plan. Detalle: {recipes_response.text}")
        recipes_by_id = {recipe.get("id"): recipe for recipe in recipes_response.json()}

    days_by_index = {
        index: {
            "dia": DAY_NAMES[index - 1],
            "costo_estimado": 0,
            "calorias_estimadas": 0,
            "comidas": [],
        }
        for index in range(1, 8)
    }

    for meal_row in meal_rows:
        day_index = int(meal_row.get("dia_semana") or 1)
        day_index = max(1, min(day_index, 7))
        recipe = recipes_by_id.get(meal_row.get("receta_id"))
        if not recipe:
            continue
        meal = _db_recipe_to_weekly_meal(recipe, meal_row, days_by_index[day_index]["dia"])
        macros = meal.get("macros_totales") or {}
        days_by_index[day_index]["comidas"].append(meal)
        days_by_index[day_index]["costo_estimado"] += float(meal.get("costo_estimado") or 0)
        days_by_index[day_index]["calorias_estimadas"] += float(macros.get("calorias") or 0)
        days_by_index[day_index]["proteinas_g"] = days_by_index[day_index].get("proteinas_g", 0) + float(macros.get("proteinas") or 0)
        days_by_index[day_index]["carbohidratos_g"] = days_by_index[day_index].get("carbohidratos_g", 0) + float(macros.get("carbohidratos") or 0)
        days_by_index[day_index]["grasas_g"] = days_by_index[day_index].get("grasas_g", 0) + float(macros.get("grasas") or 0)

    days = [day for day in days_by_index.values() if day["comidas"]]
    budget = await _get_budget(client, user_id)
    available_budget = None
    if budget:
        available_budget = float(budget.get("monto") or 0) - float(budget.get("gastado") or 0)

    loaded_plan = {
        "id": plan_row.get("id"),
        "nombre": plan_row.get("nombre"),
        "semana_inicio": plan_row.get("semana_inicio"),
        "presupuesto_id": plan_row.get("presupuesto_id"),
        "resumen": "Plan semanal guardado en tu calendario.",
        "presupuesto_disponible": available_budget,
        "presupuesto_usado": sum(float(day.get("costo_estimado") or 0) for day in days),
        "dias": days,
    }
    return _normalize_weekly_plan_macros(loaded_plan)


@router.get("/{user_id}")
async def obtener_presupuesto(user_id: str, client: httpx.AsyncClient = Depends(get_supabase_client)):
    try:
        budget = await _get_budget(client, user_id)
        return {"budget": budget}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
@router.post("/")
async def guardar_presupuesto(data: BudgetUpsertRequest, client: httpx.AsyncClient = Depends(get_supabase_client)):
    try:
        if data.monto < 0:
            raise HTTPException(status_code=400, detail="El presupuesto no puede ser negativo")

        existing = await _get_budget(client, data.user_id)
        payload = {
            "user_id": data.user_id,
            "monto": data.monto,
            "periodo": data.periodo,
            "moneda": data.moneda,
            "gastado": 0,
            "updated_at": _now_iso(),
        }

        if existing:
            response = await client.patch(f"/presupuestos?id=eq.{existing['id']}", json=payload)
        else:
            response = await client.post("/presupuestos", json=payload)

        if response.status_code not in (200, 201, 204):
            raise HTTPException(status_code=500, detail=f"No se pudo guardar presupuesto. Detalle: {response.text}")

        budget = await _get_budget(client, data.user_id)
        return {"budget": budget}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/spend")
async def descontar_presupuesto(data: BudgetSpendRequest, client: httpx.AsyncClient = Depends(get_supabase_client)):
    try:
        if data.monto <= 0:
            raise HTTPException(status_code=400, detail="El monto a descontar debe ser mayor a 0")

        budget = await _get_budget(client, data.user_id)
        if not budget:
            raise HTTPException(status_code=404, detail="No hay presupuesto configurado")

        next_spent = float(budget.get("gastado") or 0) + float(data.monto)
        response = await client.patch(
            f"/presupuestos?id=eq.{budget['id']}",
            json={"gastado": next_spent, "updated_at": _now_iso()},
        )
        if response.status_code not in (200, 204):
            raise HTTPException(status_code=500, detail=f"No se pudo descontar presupuesto. Detalle: {response.text}")

        return {"budget": await _get_budget(client, data.user_id)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/weekly-plan")
async def generar_plan_semanal(data: WeeklyPlanRequest, client: httpx.AsyncClient = Depends(get_supabase_client)):
    try:
        context = await _get_user_context(client, data.user_id)
        pantry = await _get_pantry_lines(client, data.user_id)
        plan = await generar_plan_semanal_con_ia(
            contexto_usuario=context,
            ingredientes_despensa=pantry,
            presupuesto_disponible=0,
            preferencias_semana=data.preferencias_semana or "",
            permitir_comidas_intermedias=data.permitir_comidas_intermedias,
            dias=max(1, min(data.dias, 7)),
            comidas_por_dia=max(1, min(data.comidas_por_dia, 5)),
        )
        if "error" in plan:
            return plan
        plan = _normalize_weekly_plan_macros(plan)
        plan["presupuesto_disponible"] = 0
        plan["presupuesto_usado"] = 0
        plan["compras_sugeridas"] = []
        return await _persist_weekly_plan(client, data.user_id, plan, None)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=f"Error en BD: {exc.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/weekly-plan/latest/{user_id}")
async def obtener_ultimo_plan_semanal(user_id: str, client: httpx.AsyncClient = Depends(get_supabase_client)):
    try:
        return {"plan": await _load_weekly_plan(client, user_id)}
    except HTTPException:
        raise
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=f"Error en BD: {exc.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/weekly-plan/meals/{meal_id}/recipe")
async def actualizar_receta_comida_semanal(
    meal_id: str,
    data: WeeklyMealRecipeUpdateRequest,
    client: httpx.AsyncClient = Depends(get_supabase_client),
):
    try:
        meal_response = await client.get(
            "/plan_comidas",
            params={
                "id": f"eq.{meal_id}",
                "select": "id,plan_id,receta_id,dia_semana,tipo_comida",
                "limit": "1",
            },
        )
        if meal_response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"No se pudo leer comida semanal. Detalle: {meal_response.text}")
        meals = meal_response.json()
        if not meals:
            raise HTTPException(status_code=404, detail="Comida semanal no encontrada")

        meal_row = meals[0]
        plan_response = await client.get(
            "/planes_semanales",
            params={"id": f"eq.{meal_row['plan_id']}", "select": "id,user_id", "limit": "1"},
        )
        if plan_response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"No se pudo validar plan semanal. Detalle: {plan_response.text}")
        plans = plan_response.json()
        if not plans or plans[0].get("user_id") != data.user_id:
            raise HTTPException(status_code=403, detail="No puedes editar esta comida semanal")

        day_index = int(meal_row.get("dia_semana") or 1)
        day_name = DAY_NAMES[max(1, min(day_index, 7)) - 1]
        recipe_payload = _recipe_payload_from_weekly_meal(
            data.user_id,
            data.receta,
            day_name,
            meal_row.get("tipo_comida") or data.receta.get("tipo") or "Comida",
        )

        recipe_response = await client.patch(
            f"/recetas?id=eq.{meal_row['receta_id']}",
            json=recipe_payload,
        )
        if recipe_response.status_code not in (200, 204):
            raise HTTPException(status_code=500, detail=f"No se pudo actualizar receta semanal. Detalle: {recipe_response.text}")

        saved_recipe = recipe_response.json()[0] if recipe_response.json() else {**recipe_payload, "id": meal_row["receta_id"]}
        meal = _db_recipe_to_weekly_meal(saved_recipe, meal_row, day_name)
        return {
            "meal": meal,
            "receta": _weekly_recipe_to_generated(saved_recipe, meal),
            "plan": await _load_weekly_plan(client, data.user_id, meal_row.get("plan_id")),
        }
    except HTTPException:
        raise
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=f"Error en BD: {exc.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
