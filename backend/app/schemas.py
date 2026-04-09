from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class HealthProfile(BaseModel):
    name: str = ""
    age: str = ""
    gender: str = ""
    location: str = ""
    weight: str = ""
    height: str = ""
    bloodGroup: str = ""
    conditions: str = ""
    allergies: str = ""
    medications: str = ""


class ChatRequest(BaseModel):
    user_id: str
    message: str
    health_profile: Optional[HealthProfile] = None
    history: list[dict] = Field(default_factory=list)


class ChatResponse(BaseModel):
    response: str
    memory_updates: list[str] = Field(default_factory=list)
    specialist_query: str = ""


class ChatWithFilesRequest(BaseModel):
    user_id: str
    message: str
    health_profile: Optional[HealthProfile] = None
    files: list[dict] = Field(default_factory=list)
    history: list[dict] = Field(default_factory=list)


class ReportRequest(BaseModel):
    messages: list[dict]
    health_profile: Optional[HealthProfile] = None


class AdvisoryItem(BaseModel):
    title: str
    severity: str
    description: str
    source: str = ""
    url: str = ""


class AdvisoriesRequest(BaseModel):
    location: str = ""
    conditions: str = ""
    force_refresh: bool = False


class AdvisoriesResponse(BaseModel):
    advisories: list[AdvisoryItem] = Field(default_factory=list)
    cached: bool = False
    fetched_at: Optional[str] = None
    expires_at: Optional[str] = None
    error: str = ""


class SpecialistRequest(BaseModel):
    disease: str = ""
    location: str = ""


class SpecialistItem(BaseModel):
    name: str
    specialty: str
    address: str = ""
    phone: str = ""
    rating: str = ""
    notes: str = ""


class SpecialistResponse(BaseModel):
    specialists: list[SpecialistItem] = Field(default_factory=list)
    error: str = ""


class FingerprintScanRequest(BaseModel):
    serial_port: str = ""
    baud_rate: int = 57600
    timeout_seconds: float = 20
    test_image_path: str = ""


class FingerprintScanResponse(BaseModel):
    blood_group: str
    confidence: float
    source: str
    serial_port: str = ""
    image_path: str = ""
    model: str = ""


class AutismPredictionRequest(BaseModel):
    image_base64: str
    source: str = "webcam"
    camera_name: str = ""


class AutismPredictionResponse(BaseModel):
    label: str
    confidence: float
    autistic_probability: float
    non_autistic_probability: float
    source: str
    camera_name: str = ""
    model: str
    disclaimer: str


class ResetSystemRequest(BaseModel):
    clear_memory: bool = True
    clear_advisories_cache: bool = True


class ResetSystemResponse(BaseModel):
    status: str
    cleared_backend_db: bool = False
