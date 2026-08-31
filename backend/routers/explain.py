from fastapi import APIRouter, HTTPException, Query
from backend.models_api import ExplainResponse
from backend.routers.homepage import explain_db

router = APIRouter()

@router.get("/explain", response_model=ExplainResponse)
async def explain(explanation_ref: str = Query(...)):
    if explanation_ref not in explain_db:
        raise HTTPException(status_code=404, detail="explanation_ref not found or expired")

    data = explain_db[explanation_ref]
    return ExplainResponse(
        explanation_ref=explanation_ref,
        text=data["text"],
        signal_refs=data["signal_refs"],
        score_components=data["score_components"]
    )
