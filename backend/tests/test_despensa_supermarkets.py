import unittest
from unittest.mock import AsyncMock, patch

from app.models.schemas import DespensaBarcodeAdd
from app.routers import despensa, supermarkets


class FakeResponse:
    def __init__(self, status_code=200, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload if payload is not None else []
        self.text = text

    def json(self):
        return self._payload


class FakeClient:
    def __init__(self, responses=None):
        self.responses = responses or {}
        self.calls = []

    def _next_response(self, method, url):
        key = (method, url)
        configured = self.responses.get(key, [FakeResponse()])
        if not isinstance(configured, list):
            configured = [configured]
        index = sum(1 for call in self.calls if call["method"] == method and call["url"] == url)
        return configured[min(index, len(configured) - 1)]

    async def get(self, url, params=None):
        response = self._next_response("GET", url)
        self.calls.append({"method": "GET", "url": url, "params": params})
        return response

    async def post(self, url, json=None):
        response = self._next_response("POST", url)
        self.calls.append({"method": "POST", "url": url, "json": json})
        return response

    async def patch(self, url, json=None):
        response = self._next_response("PATCH", url)
        self.calls.append({"method": "PATCH", "url": url, "json": json})
        return response


class DespensaHelperTests(unittest.TestCase):
    def test_clean_payload_removes_none_but_keeps_falsey_values(self):
        payload = {"nombre": "Leche", "marca": None, "cantidad": 0, "activo": False, "nota": ""}

        self.assertEqual(
            despensa._clean_payload(payload),
            {"nombre": "Leche", "cantidad": 0, "activo": False, "nota": ""},
        )

    def test_first_value_skips_none_and_empty_string(self):
        self.assertEqual(despensa._first_value(None, "", 0, "final"), 0)

    def test_first_value_returns_none_when_all_values_are_missing(self):
        self.assertIsNone(despensa._first_value(None, ""))

    def test_normalize_search_text_removes_accents_punctuation_and_extra_spaces(self):
        self.assertEqual(
            despensa._normalize_search_text("  Arroz integral, Ñuble!!  "),
            "arroz integral nuble",
        )

    def test_singularize_search_text_handles_common_plural_forms(self):
        self.assertEqual(despensa._singularize_search_text("tomates"), "tomat")
        self.assertEqual(despensa._singularize_search_text("manzanas"), "manzana")
        self.assertEqual(despensa._singularize_search_text("sal"), "sal")

    def test_score_catalog_product_prioritizes_exact_barcode_match(self):
        product = {"nombre": "Producto cualquiera", "categoria": "otros", "codigo_barra": "780123"}

        score = despensa._score_catalog_product(product, "leche", "lacteos", "780123")

        self.assertGreaterEqual(score, 1000)

    def test_score_catalog_product_rewards_exact_name_and_category(self):
        product = {"nombre": "Leche descremada", "categoria": "Lácteos", "codigo_barra": None}

        score = despensa._score_catalog_product(product, "leche descremada", "lacteos", "")

        self.assertEqual(score, 580)

    def test_score_catalog_product_gives_lower_score_to_partial_match(self):
        exact = {"nombre": "Leche", "categoria": "Lácteos", "codigo_barra": None}
        partial = {"nombre": "Bebida con leche sabor frutilla", "categoria": "Lácteos", "codigo_barra": None}

        exact_score = despensa._score_catalog_product(exact, "leche", "lacteos", "")
        partial_score = despensa._score_catalog_product(partial, "leche", "lacteos", "")

        self.assertGreater(exact_score, partial_score)

    def test_format_item_combines_pantry_product_and_price_data(self):
        item = {
            "id": "item-1",
            "producto_id": "prod-1",
            "cantidad": 2,
            "unidad": "kg",
            "precio_info": {
                "precio": 1990,
                "unidad": "kg",
                "supermercado_id": "sup-1",
                "supermercado_nombre": "Central",
            },
        }
        product = {
            "nombre": "Manzana",
            "categoria": "frutas",
            "grasas_totales_g": 0.2,
            "azucares_totales_g": 10.4,
            "es_personalizado": False,
        }

        formatted = despensa._format_item(item, product)

        self.assertEqual(formatted["nombre_producto"], "Manzana")
        self.assertEqual(formatted["precio_supermercado"], 1990)
        self.assertEqual(formatted["supermercado_nombre"], "Central")
        self.assertEqual(formatted["grasas_g"], 0.2)
        self.assertEqual(formatted["azucar_g"], 10.4)

    def test_format_item_uses_defaults_when_product_is_missing(self):
        formatted = despensa._format_item({"id": "item-1", "producto_id": "prod-1"})

        self.assertEqual(formatted["nombre_producto"], "Desconocido")
        self.assertEqual(formatted["categoria"], "otros")
        self.assertIsNone(formatted["precio_supermercado"])

    def test_format_catalog_product_maps_catalog_fields_to_frontend_fields(self):
        product = {
            "id": "cat-1",
            "nombre": "Avena",
            "categoria": "cereales",
            "grasas_g": 7,
            "azucar_g": 1,
        }

        formatted = despensa._format_catalog_product(product)

        self.assertEqual(formatted["nombre_producto"], "Avena")
        self.assertEqual(formatted["grasas_g"], 7)
        self.assertEqual(formatted["azucar_g"], 1)


class SupermarketServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_guardar_precio_supermercado_ignores_missing_supermarket(self):
        client = FakeClient()

        result = await supermarkets.guardar_precio_supermercado(client, "prod-1", None, 1500, "kg")

        self.assertIsNone(result)
        self.assertEqual(client.calls, [])

    async def test_guardar_precio_supermercado_ignores_missing_price(self):
        client = FakeClient()

        result = await supermarkets.guardar_precio_supermercado(client, "prod-1", "sup-1", None, "kg")

        self.assertIsNone(result)
        self.assertEqual(client.calls, [])

    async def test_guardar_precio_supermercado_creates_price_when_it_does_not_exist(self):
        client = FakeClient(
            {
                ("GET", "/precios_productos"): FakeResponse(200, []),
                ("POST", "/precios_productos"): FakeResponse(201, [{"id": "price-1"}]),
            }
        )

        result = await supermarkets.guardar_precio_supermercado(
            client, "prod-1", "sup-1", 1500, "kg", user_id="user-1"
        )

        self.assertIsNone(result)
        self.assertEqual(client.calls[1]["method"], "POST")
        self.assertEqual(client.calls[1]["json"]["precio"], 1500)
        self.assertEqual(client.calls[1]["json"]["user_id"], "user-1")

    async def test_guardar_precio_supermercado_updates_existing_price(self):
        client = FakeClient(
            {
                ("GET", "/precios_productos"): FakeResponse(200, [{"id": "price-1"}]),
                ("PATCH", "/precios_productos?id=eq.price-1"): FakeResponse(204, []),
            }
        )

        result = await supermarkets.guardar_precio_supermercado(client, "prod-1", "sup-1", 1800, "unidad")

        self.assertIsNone(result)
        self.assertEqual(client.calls[1]["method"], "PATCH")
        self.assertEqual(client.calls[1]["json"]["unidad"], "unidad")

    async def test_guardar_precio_supermercado_returns_error_when_lookup_fails(self):
        client = FakeClient({("GET", "/precios_productos"): FakeResponse(500, [], "db down")})

        result = await supermarkets.guardar_precio_supermercado(client, "prod-1", "sup-1", 1800, "unidad")

        self.assertIn("error", result)
        self.assertIn("db down", result["error"])


class DespensaAsyncHelperTests(unittest.IsolatedAsyncioTestCase):
    async def test_get_products_by_ids_returns_empty_map_without_calling_database(self):
        client = FakeClient()

        products, error = await despensa._get_products_by_ids(client, [])

        self.assertEqual(products, {})
        self.assertIsNone(error)
        self.assertEqual(client.calls, [])

    async def test_get_products_by_ids_maps_products_by_id(self):
        client = FakeClient(
            {
                ("GET", "/productos"): FakeResponse(
                    200,
                    [
                        {"id": "prod-1", "nombre": "Leche"},
                        {"id": "prod-2", "nombre": "Pan"},
                    ],
                )
            }
        )

        products, error = await despensa._get_products_by_ids(client, ["prod-1", "prod-2"])

        self.assertIsNone(error)
        self.assertEqual(products["prod-1"]["nombre"], "Leche")
        self.assertEqual(client.calls[0]["params"]["id"], "in.(prod-1,prod-2)")

    async def test_get_products_by_ids_returns_error_when_database_fails(self):
        client = FakeClient({("GET", "/productos"): FakeResponse(503, [], "service unavailable")})

        products, error = await despensa._get_products_by_ids(client, ["prod-1"])

        self.assertIsNone(products)
        self.assertIn("service unavailable", error["error"])

    async def test_get_prices_by_product_ids_keeps_first_price_and_adds_supermarket_name(self):
        client = FakeClient(
            {
                ("GET", "/precios_productos"): FakeResponse(
                    200,
                    [
                        {"producto_id": "prod-1", "precio": 900, "unidad": "kg", "supermercado_id": "sup-1"},
                        {"producto_id": "prod-1", "precio": 1200, "unidad": "kg", "supermercado_id": "sup-2"},
                    ],
                ),
                ("GET", "/supermercados"): FakeResponse(200, [{"id": "sup-1", "nombre": "Central"}]),
            }
        )

        prices, error = await despensa._get_prices_by_product_ids(client, ["prod-1"])

        self.assertIsNone(error)
        self.assertEqual(prices["prod-1"]["precio"], 900)
        self.assertEqual(prices["prod-1"]["supermercado_nombre"], "Central")

    async def test_get_prices_by_product_ids_falls_back_to_matching_catalog_product(self):
        client = FakeClient(
            {
                ("GET", "/productos_catalogo"): FakeResponse(200, [{"id": "cat-1", "codigo_barra": "780123"}]),
                ("GET", "/precios_productos"): FakeResponse(
                    200,
                    [{"producto_id": "cat-1", "precio": 1800, "unidad": "unidad", "supermercado_id": "sup-1"}],
                ),
                ("GET", "/supermercados"): FakeResponse(200, [{"id": "sup-1", "nombre": "Central"}]),
            }
        )

        prices, error = await despensa._get_prices_by_product_ids(
            client,
            ["prod-user"],
            {"prod-user": {"codigo_barra": "780123"}},
        )

        self.assertIsNone(error)
        self.assertEqual(prices["prod-user"]["precio"], 1800)
        self.assertEqual(prices["prod-user"]["supermercado_nombre"], "Central")
        catalog_call = next(call for call in client.calls if call["url"] == "/productos_catalogo")
        catalog_price_call = next(
            call
            for call in client.calls
            if call["url"] == "/precios_productos" and call["params"]["producto_id"] == "in.(cat-1)"
        )
        self.assertEqual(catalog_call["params"]["codigo_barra"], "in.(780123)")
        self.assertEqual(catalog_price_call["params"]["producto_id"], "in.(cat-1)")

    async def test_get_prices_by_product_ids_prefers_barcode_catalog_price_over_direct_price(self):
        client = FakeClient(
            {
                ("GET", "/productos_catalogo"): FakeResponse(200, [{"id": "cat-1", "codigo_barra": "780123"}]),
                ("GET", "/precios_productos"): [
                    FakeResponse(
                        200,
                        [{"producto_id": "cat-1", "precio": 1800, "unidad": "unidad", "supermercado_id": "sup-1"}],
                    ),
                    FakeResponse(
                        200,
                        [{"producto_id": "prod-user", "precio": 2200, "unidad": "unidad", "supermercado_id": "sup-2"}],
                    ),
                ],
                ("GET", "/supermercados"): [
                    FakeResponse(200, [{"id": "sup-1", "nombre": "Central"}]),
                    FakeResponse(200, [{"id": "sup-2", "nombre": "Esquina"}]),
                ],
            }
        )

        prices, error = await despensa._get_prices_by_product_ids(
            client,
            ["prod-user"],
            {"prod-user": {"codigo_barra": "780123"}},
        )

        self.assertIsNone(error)
        self.assertEqual(prices["prod-user"]["precio"], 1800)
        self.assertEqual(prices["prod-user"]["supermercado_nombre"], "Central")

    async def test_get_price_by_catalog_id_returns_best_registered_price(self):
        client = FakeClient(
            {
                ("GET", "/precios_productos"): FakeResponse(
                    200,
                    [
                        {"producto_id": "cat-1", "precio": 1500, "unidad": "unidad", "supermercado_id": "sup-1"},
                    ],
                ),
                ("GET", "/supermercados"): FakeResponse(
                    200,
                    [
                        {"id": "sup-1", "nombre": "Central"},
                    ],
                ),
            }
        )

        price, error = await despensa._get_price_by_catalog_id(client, "cat-1")

        self.assertIsNone(error)
        self.assertEqual(price["precio"], 1500)
        self.assertEqual(price["supermercado_nombre"], "Central")

    async def test_resolve_barcode_add_data_uses_catalog_match_and_category(self):
        client = FakeClient(
            {
                ("GET", "/productos_catalogo"): FakeResponse(
                    200,
                    [{"id": "cat-1", "nombre": "Leche entera", "categoria": "Lácteos", "codigo_barra": "780123"}],
                )
            }
        )
        data = DespensaBarcodeAdd(user_id="user-1", codigo_barra="780123")

        resolved, catalog_product, source, error = await despensa._resolve_barcode_add_data(client, data)

        self.assertIsNone(error)
        self.assertEqual(source, "bdd")
        self.assertEqual(catalog_product["id"], "cat-1")
        self.assertEqual(resolved.nombre_producto, "Leche entera")
        self.assertEqual(resolved.categoria, "Lácteos")
        self.assertEqual(resolved.codigo_barra, "780123")

    async def test_resolve_barcode_add_data_uses_ai_when_catalog_has_no_match(self):
        client = FakeClient({("GET", "/productos_catalogo"): FakeResponse(200, [])})
        data = DespensaBarcodeAdd(
            user_id="user-1",
            codigo_barra="780999",
            categorias_disponibles=["Lácteos", "Otros"],
            usar_ia=True,
        )

        with patch(
            "app.routers.despensa.identificar_producto_por_codigo_barras",
            new=AsyncMock(
                return_value={
                    "es_alimento": True,
                    "nombre_producto": "Yogur natural",
                    "categoria": "Lácteos",
                    "marca": "Marca Test",
                    "energia_kcal": 63,
                    "proteinas_g": 5,
                    "carbohidratos_g": 7,
                    "grasas_g": 2,
                    "fibra_g": 0,
                    "sodio_mg": 70,
                    "azucar_g": 7,
                }
            ),
        ) as identify:
            resolved, catalog_product, source, error = await despensa._resolve_barcode_add_data(client, data)

        self.assertIsNone(error)
        self.assertEqual(source, "ia")
        self.assertIsNone(catalog_product)
        identify.assert_awaited_once_with("780999", ["Lácteos", "Otros"])
        self.assertEqual(resolved.nombre_producto, "Yogur natural")
        self.assertEqual(resolved.categoria, "Lácteos")
        self.assertEqual(resolved.marca, "Marca Test")
        self.assertEqual(resolved.energia_kcal, 63)

    async def test_resolve_barcode_add_data_requires_confirmation_before_using_ai(self):
        client = FakeClient({("GET", "/productos_catalogo"): FakeResponse(200, [])})
        data = DespensaBarcodeAdd(
            user_id="user-1",
            codigo_barra="780999",
            categorias_disponibles=["Lácteos", "Otros"],
        )

        with patch("app.routers.despensa.identificar_producto_por_codigo_barras", new=AsyncMock()) as identify:
            resolved, catalog_product, source, error = await despensa._resolve_barcode_add_data(client, data)

        identify.assert_not_awaited()
        self.assertIsNone(resolved)
        self.assertIsNone(catalog_product)
        self.assertIsNone(source)
        self.assertTrue(error["requiere_ia"])
        self.assertEqual(error["codigo_barra"], "780999")

    async def test_resolve_barcode_add_data_rejects_non_food_ai_result(self):
        client = FakeClient({("GET", "/productos_catalogo"): FakeResponse(200, [])})
        data = DespensaBarcodeAdd(
            user_id="user-1",
            codigo_barra="780111",
            categorias_disponibles=["Lácteos", "Otros"],
            usar_ia=True,
        )

        with patch(
            "app.routers.despensa.identificar_producto_por_codigo_barras",
            new=AsyncMock(
                return_value={
                    "es_alimento": False,
                    "nombre_producto": "Paracetamol",
                    "categoria": "Otros",
                    "marca": "Marca Test",
                    "aviso": "El codigo escaneado parece ser un medicamento, no un alimento.",
                }
            ),
        ):
            resolved, catalog_product, source, error = await despensa._resolve_barcode_add_data(client, data)

        self.assertIsNone(resolved)
        self.assertIsNone(catalog_product)
        self.assertIsNone(source)
        self.assertEqual(error["tipo"], "no_alimento")
        self.assertIn("medicamento", error["error"])


if __name__ == "__main__":
    unittest.main()
