from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, users, rechipes, supermarkets
from app.dependencias import get_supabase_client

app = FastAPI(title="Rechipe API", version="1.0.0")

# CORS — permite que el frontend se conecte al backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # en produccion cambiar por la URL del frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar los routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(rechipes.router)
app.include_router(supermarkets.router)

@app.get("/")
async def root():
    return {"status": "ok", "message": "Rechipe API v1"}


@app.get("/health")
async def health():
    """ verifica que el servidor y la coneccion asupabase funcionen correctamente """
    #el "try:" es para atrapar errores, 
    try: # esto sirve para atrapar errores y poder mandar un mensaje mas claro al usuario
        async with get_supabase_client() as client: # el async with es para que el cliente se conecte de forma segura y se desconecte automaticamente
           response = await client.get("/health") # esto es para probar la coneccion a supabase
           if response.status_code == 200: # el igual a 200 significa que todo esta bien 
            return {"status":"healthy", "database": "connected"}
           else:
            return {"status":"unhealthy", "database": "error", "detail": response.text} # si no esta conectado a supabase
    except Exception as e:
        return {"status":"unhealthy", "database": "error", "detail": str(e)} # si hay un error al conectar a supabase


