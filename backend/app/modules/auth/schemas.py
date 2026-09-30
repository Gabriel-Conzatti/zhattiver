from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class UserPublic(BaseModel):
    id: str
    email: str
    name: str
    role: str
    organization_id: str
    products: list[str] = Field(default_factory=list)
    grants: list[str] = Field(default_factory=list)
