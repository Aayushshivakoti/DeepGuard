"""
app/schemas/auth.py — Authentication Pydantic Schemas
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=8, description="Password (min 8 chars)")
    role: str = Field(default="user", description="User role: 'user' or 'admin'")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserProfile(BaseModel):
    id: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Response models
class RegisterResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Token expiry in seconds")
    role: str
    user: UserProfile

class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Token expiry in seconds")

class TokenPayload(BaseModel):
    sub: UUID
    exp: int
    role: str

class PasswordResetResponse(BaseModel):
    status: str
    message: str
    debug_token: Optional[str] = None

class EmailVerificationResponse(BaseModel):
    status: str
    message: str
