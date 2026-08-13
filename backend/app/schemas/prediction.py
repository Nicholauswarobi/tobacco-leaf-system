"""Pydantic schemas: request/response shapes for the prediction API."""
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class ClassProbability(BaseModel):
    label: str
    probability: float = Field(..., ge=0.0, le=1.0)


class VerificationResult(BaseModel):
    """Verdict from the Tobacco Verification Model.

    Present on every successful prediction so clients can show *why* the image
    was allowed through, and returned standalone by POST /api/verify.
    """

    is_tobacco: bool
    label: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    message: str
    # "verification_model" | "color_prescreen" | "disabled"
    method: str
    threshold: float
    all_probabilities: List[ClassProbability] = []
    detail: Optional[str] = None


class VerificationResponse(BaseModel):
    """Standalone response for POST /api/verify."""

    verification: VerificationResult
    image_url: Optional[str] = None
    processing_time_ms: float


class TreatmentMedicine(BaseModel):
    """One product a grower can buy, with the rate and spray interval."""

    name: str
    dose: str
    interval: str


class DiseaseTreatment(BaseModel):
    """Short, field-ready answer to "what do I do now?".

    Deliberately terse: growers read this on a phone in the field, so each
    field is one line. Longer agronomy belongs with the extension officer.
    """

    urgency: str
    summary: str
    medicines: List[TreatmentMedicine] = []
    actions: List[str] = []
    caution: Optional[str] = None


class DiseaseResult(BaseModel):
    label: str
    confidence: float
    description: str
    recommendations: List[str]
    # Optional so history rows written before treatments existed still load.
    treatment: Optional[DiseaseTreatment] = None
    all_probabilities: List[ClassProbability]


class QualityResult(BaseModel):
    grade: str
    confidence: float
    description: str
    market_value: str
    all_probabilities: List[ClassProbability]


class PredictionResponse(BaseModel):
    id: str
    timestamp: datetime
    image_url: Optional[str] = None
    # "disease" = disease-only, "quality" = quality-only, "full" = both
    mode: str = "disease"
    # Always populated: nothing reaches disease/quality without passing this.
    # Optional only so older persisted history rows still deserialize.
    verification: Optional[VerificationResult] = None
    disease: DiseaseResult
    quality: QualityResult
    processing_time_ms: float


class HistoryItem(BaseModel):
    id: str
    timestamp: datetime
    image_url: Optional[str]
    mode: str = "disease"
    disease_label: str
    disease_confidence: float
    quality_grade: str
    quality_confidence: float


class HistoryResponse(BaseModel):
    items: List[HistoryItem]
    total: int


class HealthResponse(BaseModel):
    status: str
    version: str
    model_loaded: bool
    quality_model_loaded: bool = False
    verification_model_loaded: bool = False
    # Which tier the gate is currently running on.
    verification_method: str = "color_prescreen"
    verification_threshold: float = 0.5
    uptime_seconds: float
