from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas, database, auth_utils

router = APIRouter(prefix="/todos", tags=["todos"])

@router.post("/", response_model=schemas.TodoResponse, status_code=status.HTTP_201_CREATED)
def create_todo(todo: schemas.TodoCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth_utils.get_current_user)):
    db_todo = models.Todo(**todo.dict(), owner=current_user)
    db.add(db_todo)
    db.commit()
    db.refresh(db_todo)
    return db_todo

@router.get("/", response_model=schemas.PaginatedTodos)
def list_todos(page: int = 1, per_page: int = 10, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth_utils.get_current_user)):
    skip = (page - 1) * per_page
    todos = db.query(models.Todo).filter(models.Todo.user_id == current_user.id).offset(skip).limit(per_page).all()
    total = db.query(models.Todo).filter(models.Todo.user_id == current_user.id).count()
    return schemas.PaginatedTodos(items=todos, total=total, page=page, per_page=per_page)

@router.get("/{id}", response_model=schemas.TodoResponse)
def get_todo(id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth_utils.get_current_user)):
    todo = db.query(models.Todo).filter(models.Todo.id == id, models.Todo.user_id == current_user.id).first()
    if not todo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found")
    return todo

@router.put("/{id}", response_model=schemas.TodoResponse)
def update_todo(id: int, todo: schemas.TodoUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth_utils.get_current_user)):
    db_todo = db.query(models.Todo).filter(models.Todo.id == id, models.Todo.user_id == current_user.id).first()
    if not db_todo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found")
    for key, value in todo.dict(exclude_unset=True).items():
        setattr(db_todo, key, value)
    db.commit()
    db.refresh(db_todo)
    return db_todo

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth_utils.get_current_user)):
    db_todo = db.query(models.Todo).filter(models.Todo.id == id, models.Todo.user_id == current_user.id).first()
    if not db_todo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found")
    db.delete(db_todo)
    db.commit()
    return None
