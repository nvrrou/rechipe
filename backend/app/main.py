from fastapi import FastAPI

app = FastAPI(title="Rechipe API", version="1.0.0")

@app.get("/")
async def root():
    return {"status": "ok", "message": "Rechipe API v1"}




