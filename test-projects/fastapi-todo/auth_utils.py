import hashlib
import secrets
from datetime import datetime, timedelta
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from . import models, database

SECRET_KEY = "secret-key"
ALGORITHM = "HS256"

# Password hashing

def get_password_hash(password: str) -> str:
    salt = secrets.token_hex(16)
    hash = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}${hash}"

def verify_password(password: str, hashed: str) -> bool:
    salt, hash = hashed.split('$')
    return hash == hashlib.sha256((salt + password).encode()).hexdigest()

# JWT token creation

def create_access_token(data: dict, secret: str = SECRET_KEY, expires_minutes: int = 30):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, secret, algorithm=ALGORITHM)

# Dependency to get current user

def get_current_user(token: str, db: Session = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
    return user
