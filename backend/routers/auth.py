from sqlalchemy.exc import IntegrityError
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models import User, RoleEnum
from auth.security import verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from auth.dependencies import get_current_user
from limiter import limiter
import os
import httpx

router = APIRouter(prefix="/auth", tags=["auth"])

AZURE_ADMIN_GROUP_ID   = os.getenv("AZURE_ADMIN_GROUP_ID", "")
AZURE_MANAGER_GROUP_ID = os.getenv("AZURE_MANAGER_GROUP_ID", "")

def map_groups_to_role(group_ids: list[str]) -> RoleEnum:
    if AZURE_ADMIN_GROUP_ID and AZURE_ADMIN_GROUP_ID in group_ids:
        return RoleEnum.ADMIN
    if AZURE_MANAGER_GROUP_ID and AZURE_MANAGER_GROUP_ID in group_ids:
        return RoleEnum.MANAGER
    return RoleEnum.EMPLOYEE


class AzureTokenRequest(BaseModel):
    access_token: str


@router.post("/azure")
async def login_with_azure(
    payload: AzureTokenRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    token = payload.access_token

    async with httpx.AsyncClient() as client:
        profile_res = await client.get(
            "https://graph.microsoft.com/v1.0/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        if profile_res.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired Azure AD token."
            )
        profile = profile_res.json()

        groups_res = await client.get(
            "https://graph.microsoft.com/v1.0/me/memberOf?$select=id",
            headers={"Authorization": f"Bearer {token}"}
        )
        group_ids: list[str] = []
        if groups_res.status_code == 200:
            group_ids = [g["id"] for g in groups_res.json().get("value", [])]

    oid   = profile.get("id")
    email = profile.get("mail") or profile.get("userPrincipalName", "")
    name  = profile.get("displayName", email)

    if not oid or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not extract user identity from Azure AD profile."
        )

    role = map_groups_to_role(group_ids)

    try:
        user = db.query(User).filter(User.id == oid).first()
        if not user:
            user = db.query(User).filter(User.email == email).first()
        
        if not user:
            user = User(id=oid, name=name, email=email, role=role)
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            user.name = name
            user.role = role
            db.commit()
            db.refresh(user)
    except IntegrityError:
        db.rollback()
        user = db.query(User).filter((User.id == oid) | (User.email == email)).first()
        user.name = name
        user.role = role
        db.commit()
        db.refresh(user)

    expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role.value, "user_id": user.id},
        expires_delta=expires
    )
    
    is_prod = os.getenv("APP_ENV", "development") == "production"
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=is_prod
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "message": "SSO login successful"
    }


@router.post("/login")
@limiter.limit("10/minute")
def login_for_access_token(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
):
    user = db.query(User).filter(User.email == form_data.username).first()
    
    if not user or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role.value, "user_id": user.id},
        expires_delta=access_token_expires
    )
    
    is_prod = os.getenv("APP_ENV", "development") == "production"
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=is_prod
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "message": "Login successful"
    }


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(
        key="access_token",
        httponly=True,
        samesite="lax"
    )
    return {"message": "Logged out successfully"}


@router.get("/me")
def read_users_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "name": current_user.name
    }
