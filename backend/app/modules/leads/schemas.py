from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class VehicleInput(BaseModel):
    plate: str | None = None
    model: str | None = None
    year: int | None = None
    notes: str | None = None


class LeadCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    kind: str = Field(default="pf")
    phones: list[str] = Field(default_factory=list, min_length=1, max_length=5)
    document: str | None = Field(default=None, max_length=20)
    city: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, max_length=2)
    indicator_name: str | None = Field(default=None, max_length=200)
    notes: str | None = None
    origin_id: str | None = None
    client_type_id: str | None = None
    vehicles: list[VehicleInput] = Field(default_factory=list)

    @field_validator("kind")
    @classmethod
    def _kind(cls, v: str) -> str:
        if v not in ("pf", "pj"):
            raise ValueError("kind deve ser 'pf' ou 'pj'")
        return v


class LeadUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    kind: str | None = None
    document: str | None = None
    city: str | None = None
    state: str | None = None
    indicator_name: str | None = None
    notes: str | None = None
    origin_id: str | None = None
    client_type_id: str | None = None


class LeadPhoneOut(BaseModel):
    phone_e164: str
    original: str | None
    is_primary: bool


class LeadOut(BaseModel):
    id: str
    kind: str
    name: str
    document: str | None
    city: str | None
    state: str | None
    indicator_name: str | None
    notes: str | None
    origin_id: str | None
    client_type_id: str | None
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
    phones: list[LeadPhoneOut] = Field(default_factory=list)


class LeadListItem(BaseModel):
    id: str
    name: str
    kind: str
    city: str | None
    state: str | None
    phones: list[str] = Field(default_factory=list)
    archived: bool = False


class LeadListResponse(BaseModel):
    items: list[LeadListItem]
    page: int
    per_page: int
    total: int


class AvailabilityCreate(BaseModel):
    lead_id: str
    product_id: str
    team_id: str | None = None
    origin_id: str | None = None


class AvailabilityOut(BaseModel):
    id: str
    lead_id: str
    product_id: str
    lead_name: str
    lead_city: str | None
    lead_state: str | None
    phones: list[str]
    origin_id: str | None
    released_at: datetime
    claimed_by: str | None
