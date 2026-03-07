import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .main import app
from .database import Base, get_db
from .auth_utils import create_access_token

# Setup in-memory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Dependency override

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_and_teardown_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

# Helper function

def register_and_login(username: str, password: str):
    client.post("/auth/register", json={"username": username, "password": password})
    response = client.post("/auth/login", json={"username": username, "password": password})
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

# Tests

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_register():
    response = client.post("/auth/register", json={"username": "testuser", "password": "testpass"})
    assert response.status_code == 201

def test_login():
    client.post("/auth/register", json={"username": "testuser", "password": "testpass"})
    response = client.post("/auth/login", json={"username": "testuser", "password": "testpass"})
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_create_todo():
    headers = register_and_login("testuser", "testpass")
    response = client.post("/todos", json={"title": "Test Todo", "description": "Test Description"}, headers=headers)
    assert response.status_code == 201

def test_list_todos():
    headers = register_and_login("testuser", "testpass")
    client.post("/todos", json={"title": "Test Todo", "description": "Test Description"}, headers=headers)
    response = client.get("/todos", headers=headers)
    assert response.status_code == 200
    assert len(response.json()["items"]) == 1

def test_get_todo():
    headers = register_and_login("testuser", "testpass")
    client.post("/todos", json={"title": "Test Todo", "description": "Test Description"}, headers=headers)
    response = client.get("/todos/1", headers=headers)
    assert response.status_code == 200
    assert response.json()["title"] == "Test Todo"

def test_update_todo():
    headers = register_and_login("testuser", "testpass")
    client.post("/todos", json={"title": "Test Todo", "description": "Test Description"}, headers=headers)
    response = client.put("/todos/1", json={"title": "Updated Todo"}, headers=headers)
    assert response.status_code == 200
    assert response.json()["title"] == "Updated Todo"

def test_delete_todo():
    headers = register_and_login("testuser", "testpass")
    client.post("/todos", json={"title": "Test Todo", "description": "Test Description"}, headers=headers)
    response = client.delete("/todos/1", headers=headers)
    assert response.status_code == 204

def test_unauthorized():
    response = client.get("/todos")
    assert response.status_code == 401

def test_register_duplicate():
    client.post("/auth/register", json={"username": "testuser", "password": "testpass"})
    response = client.post("/auth/register", json={"username": "testuser", "password": "testpass"})
    assert response.status_code == 400
