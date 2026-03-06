from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from models import Todo, User
from schemas import TodoCreate, TodoUpdate, TodoResponse, PaginatedTodos
from auth_utils import get_current_user
from database import get_db

router = APIRouter()


@router.post("/todos", response_model=TodoResponse, status_code=status.HTTP_201_CREATED)
def create_todo(todo: TodoCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_todo = Todo(title=todo.title, description=todo.description, user_id=current_user.id)
    db.add(db_todo)
    db.commit()
    db.refresh(db_todo)
    return db_todo


@router.get("/todos", response_model=PaginatedTodos)
def list_todos(page: int = 1, per_page: int = 10, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    todos_query = db.query(Todo).filter(Todo.user_id == current_user.id)
    total = todos_query.count()
    todos = todos_query.offset((page - 1) * per_page).limit(per_page).all()
    return PaginatedTodos(items=todos, total=total, page=page, per_page=per_page)


@router.get("/todos/{id}", response_model=TodoResponse)
def get_todo(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    todo = db.query(Todo).filter(Todo.id == id, Todo.user_id == current_user.id).first()
    if not todo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found")
    return todo


@router.put("/todos/{id}", response_model=TodoResponse)
def update_todo(id: int, todo: TodoUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_todo = db.query(Todo).filter(Todo.id == id, Todo.user_id == current_user.id).first()
    if not db_todo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found")
    for key, value in todo.model_dump(exclude_unset=True).items():
        setattr(db_todo, key, value)
    db.commit()
    db.refresh(db_todo)
    return db_todo


@router.delete("/todos/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_todo = db.query(Todo).filter(Todo.id == id, Todo.user_id == current_user.id).first()
    if not db_todo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found")
    db.delete(db_todo)
    db.commit()
    return None
