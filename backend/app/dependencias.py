import httpx 
from app.config import SUPABASE_URL, SUPABASE_KEY


#headers para todas las peticiones a supabase

SUPABASE_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}", # aca se manda el token de autenticacion para poder acceder a los datos protegidos
    "Content-Type": "application/json", # esto es para que el servidor sepa que le estamos enviando un archivo json
    "Prefer": "return=representation", #esto es para que supabase devuelva el registro despues de hacer una peticion
}

def get_supabase_client() -> httpx.AsyncClient:
    """Crea un cliente HTTP configurado para supabase"""

    #el rest/v1 es para que supabase sepa que le estamos enviando una peticion a la base de datos
    return httpx.AsyncClient(base_url=f"{SUPABASE_URL}/rest/v1", headers=SUPABASE_HEADERS)



