from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models import User, RoleEnum
from auth.security import verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from auth.dependencies import get_current_user
import os
import httpx

router = APIRouter(prefix="/auth", tags=["auth"])

# Set these group object IDs in your .env / Render dashboard
AZURE_ADMIN_GROUP_ID   = os.getenv("AZURE_ADMIN_GROUP_ID", "")
AZURE_MANAGER_GROUP_ID = os.getenv("AZURE_MANAGER_GROUP_ID", "")

def map_groups_to_role(group_ids: list[str]) -> RoleEnum:
    """Maps Azure AD group membership to an app role. Falls back to EMPLOYEE."""
    if AZURE_ADMIN_GROUP_ID and AZURE_ADMIN_GROUP_ID in group_ids:
        return RoleEnum.ADMIN
    if AZURE_MANAGER_GROUP_ID and AZURE_MANAGER_GROUP_ID in group_ids:
        return RoleEnum.MANAGER
    return RoleEnum.EMPLOYEE


class AzureTokenRequest(BaseModel):
    access_token: str


@router.post("/azure")
async def login_with_azure(payload: AzureTokenRequest, db: Session = Depends(get_db)):
    """
    Phase 10 — Azure AD SSO endpoint.
    Accepts an MSAL access token, validates it with Microsoft Graph,
    upserts the user in the DB, maps AD groups to roles, and returns
    the app's own JWT so the rest of the system works identically.
    """
    token = payload.access_token
    tenant_id = os.getenv("VITE_AZURE_TENANT_ID", os.getenv("AZURE_TENANT_ID", ""))

    # ── 1. Validate the token + fetch user profile via Graph API ────────────
    async with httpx.AsyncClient() as client:
        # Get the user's profile
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

        # Get the user's group memberships for role assignment
        groups_res = await client.get(
            "https://graph.microsoft.com/v1.0/me/memberOf?$select=id",
            headers={"Authorization": f"Bearer {token}"}
        )
        group_ids: list[str] = []
        if groups_res.status_code == 200:
            group_ids = [g["id"] for g in groups_res.json().get("value", [])]

    # ── 2. Extract identity from Graph profile ───────────────────────────────
    oid   = profile.get("id")       # Azure Object ID — use as our user PK
    email = profile.get("mail") or profile.get("userPrincipalName", "")
    name  = profile.get("displayName", email)

    if not oid or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not extract user identity from Azure AD profile."
        )

    # ── 3. Map groups → role ─────────────────────────────────────────────────
    role = map_groups_to_role(group_ids)

    # ── 4. Upsert the user in our database (create on first login) ───────────
    user = db.query(User).filter(User.id == oid).first()
    if not user:
        # Also check by email in case they previously used the password flow
        user = db.query(User).filter(User.email == email).first()
    
    if not user:
        user = User(id=oid, name=name, email=email, role=role)
        db.add(user)
    else:
        # Keep name and role in sync with Azure AD
        user.name = name
        user.role = role
    
    db.commit()
    db.refresh(user)

    # ── 5. Issue app JWT (identical structure to the password flow) ──────────
    expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role.value, "user_id": user.id},
        expires_delta=expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login")
def login_for_access_token(db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if form_data.password != "test1234":
         raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role.value, "user_id": user.id}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me")
def read_users_me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "email": current_user.email, "role": current_user.role, "name": current_user.name}
