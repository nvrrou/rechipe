import os 
from dotenv import load_dotenv

load_dotenv()  # esto carga las variables del archivo .env

# el "os" es para que el programa sepa donde buscar las variables de entorno
# y "getenv" es para que el programa pueda obtener esas variables
# no se conocen las claves por seguridad, solo el nombre de la variable
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
