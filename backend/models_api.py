from pydantic import BaseModel, Field, StringConstraints
from typing import Annotated, Any

class PreferencesBody(BaseModel):
    device_id: str = Field(..., min_length=1, max_length=128)
    personas: list[Annotated[str, StringConstraints(max_length=64)]] = Field(default=[], max_length=20)
    health_flags: list[Annotated[str, StringConstraints(max_length=64)]] = Field(default=[], max_length=20)
    saved_locations: list[dict] = Field(default=[], max_length=20)

class SignalRef(BaseModel):
    signal: str
    value: Any = None
    source: str

class WarningResponse(BaseModel):
    severity: str
    type: str
    text: str

class CardResponse(BaseModel):
    card_id: str
    title: str
    priority: str
    is_alert: bool
    value_summary: str
    source: str
    freshness_badge: str | None = None
    explanation_ref: str

class HomepageResponse(BaseModel):
    context_snapshot_id: str
    generated_at: str
    cards: list[CardResponse]
    warnings_override: list[WarningResponse] = []
    system_notice: str | None = None

class ScoreComponentsRef(BaseModel):
    persona_weight: float
    urgency_multiplier: float
    confidence_factor: float

class ExplainResponse(BaseModel):
    explanation_ref: str
    text: str
    signal_refs: list[SignalRef]
    score_components: ScoreComponentsRef
