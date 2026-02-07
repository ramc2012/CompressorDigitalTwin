"""
Authentication API Routes
Login, token refresh, and user management endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Optional
from datetime import timedelta

from app.services.auth_service import get_auth_service


router = APIRouter(prefix="/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# Schemas
class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    user: dict


class UserCreate(BaseModel):
    username: str
    password: str
    role: str
    full_name: str
    email: str


class UserResponse(BaseModel):
    username: str
    role: str
    full_name: str
    email: str


# Dependencies
async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Dependency to get current authenticated user."""
    auth = get_auth_service()
    user = auth.get_current_user(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def require_admin(current_user: dict = Depends(get_current_user)):
    """Dependency to require admin role."""
    auth = get_auth_service()
    if not auth.check_permission(current_user, "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


async def require_engineer(current_user: dict = Depends(get_current_user)):
    """Dependency to require engineer or higher role."""
    auth = get_auth_service()
    if not auth.check_permission(current_user, "engineer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Engineer access required"
        )
    return current_user


# Routes
@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Authenticate user and return JWT token.
    
    Default users:
    - admin / admin123
    - engineer / engineer123
    - operator / operator123
    """
    auth = get_auth_service()
    user = auth.authenticate_user(form_data.username, form_data.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token = auth.create_access_token(
        data={"sub": user["username"], "role": user["role"]}
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": 60 * 60,  # 1 hour in seconds
        "user": user
    }


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user information."""
    return current_user


@router.post("/users", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    current_user: dict = Depends(require_admin)
):
    """Create a new user (admin only)."""
    auth = get_auth_service()
    
    try:
        new_user = auth.create_user(
            username=user_data.username,
            password=user_data.password,
            role=user_data.role,
            full_name=user_data.full_name,
            email=user_data.email
        )
        return new_user
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/users")
async def list_users(current_user: dict = Depends(require_admin)):
    """List all users (admin only)."""
    auth = get_auth_service()
    users = []
    for username, data in auth.users.items():
        users.append({
            "username": data["username"],
            "role": data["role"],
            "full_name": data["full_name"],
            "email": data["email"]
        })
    return users
