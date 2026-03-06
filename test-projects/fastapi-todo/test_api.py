import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from main import app
from database import Base, get_db
from models import User

# Create an in-memory SQLite database for testing with shared connection
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
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

# Helper function to register and login a user
def register_and_login(username: str, password: str):
    client.post("/auth/register", json={"username": username, "password": password})
    response = client.post("/auth/login", json={"username": username, "password": password})
    return response.json()["access_token"]

# Tests

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_register():
    response = client.post("/auth/register", json={"username": "testuser", "password": "testpass"})
    assert response.status_code == 201
    assert "id" in response.json()


def test_login():
    client.post("/auth/register", json={"username": "testuser", "password": "testpass"})
    response = client.post("/auth/login", json={"username": "testuser", "password": "testpass"})
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_create_todo():
    token = register_and_login("testuser", "testpass")
    response = client.post("/todos", json={"title": "Test Todo", "description": "Test Description"}, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 201
    assert response.json()["title"] == "Test Todo"


def test_list_todos():
    token = register_and_login("testuser", "testpass")
    client.post("/todos", json={"title": "Test Todo", "description": "Test Description"}, headers={"Authorization": f"Bearer {token}"})
    response = client.get("/todos", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert len(response.json()["items"]) == 1


def test_get_todo():
    token = register_and_login("testuser", "testpass")
    todo_response = client.post("/todos", json={"title": "Test Todo", "description": "Test Description"}, headers={"Authorization": f"Bearer {token}"})
    todo_id = todo_response.json()["id"]
    response = client.get(f"/todos/{todo_id}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["id"] == todo_id


def test_update_todo():
    token = register_and_login("testuser", "testpass")
    todo_response = client.post("/todos", json={"title": "Test Todo", "description": "Test Description"}, headers={"Authorization": f"Bearer {token}"})
    todo_id = todo_response.json()["id"]
    response = client.put(f"/todos/{todo_id}", json={"title": "Updated Todo"}, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["title"] == "Updated Todo"


def test_delete_todo():
    token = register_and_login("testuser", "testpass")
    todo_response = client.post("/todos", json={"title": "Test Todo", "description": "Test Description"}, headers={"Authorization": f"Bearer {token}"})
    todo_id = todo_response.json()["id"]
    response = client.delete(f"/todos/{todo_id}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 204


def test_unauthorized():
    response = client.get("/todos")
    assert response.status_code == 401


def test_register_duplicate():
    client.post("/auth/register", json={"username": "testuser", "password": "testpass"})
    response = client.post("/auth/register", json={"username": "testuser", "password": "testpass"})
    assert response.status_code == 400
