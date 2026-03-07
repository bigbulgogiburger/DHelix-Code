from fastapi import FastAPI
from routers import auth, todos
from database import engine, Base

app = FastAPI()

Base.metadata.create_all(bind=engine)

app.include_router(auth.router)
app.include_router(todos.router)

@app.get("/health")
async def health_check():
    return {"status": "ok"}
