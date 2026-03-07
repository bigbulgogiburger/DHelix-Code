from fastapi import FastAPI
from routers import auth

app = FastAPI()

app.include_router(auth.router)

@app.get("/health")
async def health_check():
    return {"status": "ok"}
