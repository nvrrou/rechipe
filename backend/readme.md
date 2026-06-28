## CORRER:
source .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

## CORRER EN WINDOWS (al menos en mi pc (cris))
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

## MIGRACION SOCIAL
Antes de usar roles admin/editor/espectador, ejecutar en Supabase SQL Editor:
backend/sql/social_groups_roles.sql
