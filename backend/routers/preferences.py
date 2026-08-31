from fastapi import APIRouter
from backend.db import get_connection, _in_memory_prefs
import json, datetime
from backend.models_api import PreferencesBody
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/preferences")
def read_preferences(device_id: str):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT device_id, personas, health_flags, saved_locations FROM preferences WHERE device_id=%s", (device_id,))
                row = cur.fetchone()
                if row is None:
                    mem = _in_memory_prefs.get(device_id)
                    if mem:
                        return mem
                    return {"device_id": device_id, "personas": ["default_general"], "health_flags": [], "saved_locations": []}
                return {
                    "device_id": row[0],
                    "personas": json.loads(row[1]) if isinstance(row[1], str) else row[1],
                    "health_flags": json.loads(row[2]) if isinstance(row[2], str) else row[2],
                    "saved_locations": json.loads(row[3] or "[]") if isinstance(row[3], str) else (row[3] or []),
                }
    except Exception as e:
        logger.warning(f"DB read error for device {device_id}, falling back to in-memory: {e}")
        mem = _in_memory_prefs.get(device_id)
        if mem:
            return mem
        return {"device_id": device_id, "personas": ["default_general"], "health_flags": [], "saved_locations": []}

@router.put("/preferences")
def write_preferences(body: PreferencesBody):
    pref_data = {
        "device_id": body.device_id,
        "personas": body.personas,
        "health_flags": body.health_flags,
        "saved_locations": body.saved_locations
    }
    _in_memory_prefs[body.device_id] = pref_data
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO preferences (device_id, personas, health_flags, saved_locations, updated_at)
                       VALUES (%s, %s, %s, %s, %s)
                       ON CONFLICT(device_id) DO UPDATE SET
                         personas=EXCLUDED.personas, health_flags=EXCLUDED.health_flags,
                         saved_locations=EXCLUDED.saved_locations, updated_at=EXCLUDED.updated_at""",
                    (body.device_id, json.dumps(body.personas), json.dumps(body.health_flags),
                     json.dumps(body.saved_locations), datetime.datetime.utcnow().isoformat()),
                )
            conn.commit()
    except Exception as e:
        logger.warning(f"DB write error for device {body.device_id}, stored in memory: {e}")
    return {"status": "ok"}
