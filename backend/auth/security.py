import os
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt

from dotenv import load_dotenv

# Load .env for local development
load_dotenv()

# Environment mode: 'development' or 'production'
APP_ENV = os.getenv("APP_ENV", "development")

# SECRET_KEY must be provided in production. For development, a temporary
# default is allowed but MUST be changed before deploying.
SECRET_KEY = os.getenv("SECRET_KEY")
if APP_ENV == "production" and not SECRET_KEY:
    raise RuntimeError("SECRET_KEY must be set in production environment")
if not SECRET_KEY:
    SECRET_KEY = "dev-secret-key-change-me"

# JWT config
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

import bcrypt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
