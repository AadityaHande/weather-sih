import os
import json
import math
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/persona-insights", tags=["insights"])

class PersonaMetric(BaseModel):
    key: str
    label: str
    unit: Optional[str] = ""

class PersonaConfigModel(BaseModel):
    id: str
    label: str
    scoreLabel: Optional[str] = "Persona Score"
    windowLabel: Optional[str] = "Best Window"
    avoidLabel: Optional[str] = "Window to Avoid"
    metrics: Optional[List[PersonaMetric]] = None
    scoringWeights: Optional[Dict[str, float]] = None
    primaryFocus: Optional[str] = "weather optimization"

class PersonaInsightsRequest(BaseModel):
    personaId: str
    personaConfig: Optional[PersonaConfigModel] = None
    weatherData: Dict[str, Any]
    clientCurrentTime: Optional[str] = None # e.g. "22:45" or ISO string
    tempUnit: Optional[str] = "c"
    windUnit: Optional[str] = "kmh"

PERSONA_SCHEDULES = {
    "fitness": {
        "morning": {"start": 6.0, "end": 7.5, "label": "6:00 AM – 7:30 AM"},
        "afternoon": {"start": 17.5, "end": 19.0, "label": "5:30 PM – 7:00 PM"},
        "avoid": {"start": 12.0, "end": 15.5, "label": "12:00 PM – 3:30 PM", "reason": "Midday thermal accumulation and peak solar UV index."},
        "focus": "aerobic efficiency, thermal comfort, and pace management",
        "expected": "20°C, 55% humidity, calm breeze, dry track"
    },
    "health": {
        "morning": {"start": 9.5, "end": 11.5, "label": "9:30 AM – 11:30 AM"},
        "afternoon": {"start": 15.5, "end": 17.0, "label": "3:30 PM – 5:00 PM"},
        "avoid": {"start": 6.5, "end": 8.5, "label": "6:30 AM – 8:30 AM", "reason": "Early morning inversion concentrates ground-level fine particulates and pollen."},
        "focus": "respiratory particulate safety, clean air, and UV protection",
        "expected": "Clean air circulation, low PM2.5 density, safe solar index"
    },
    "traveler": {
        "morning": {"start": 10.0, "end": 12.0, "label": "10:00 AM – 12:00 PM"},
        "afternoon": {"start": 13.5, "end": 15.5, "label": "1:30 PM – 3:30 PM"},
        "avoid": {"start": 8.0, "end": 9.5, "label": "8:00 AM – 9:30 AM", "reason": "Morning peak rush hour traffic congestion, reduced visibility, and transit delays."},
        "focus": "road visibility, transit friction, and storm avoidance",
        "expected": "Dry roadway surfaces, 10 km visibility, zero weather delay"
    },
    "beach": {
        "morning": {"start": 7.5, "end": 10.0, "label": "7:30 AM – 10:00 AM"},
        "afternoon": {"start": 16.0, "end": 18.0, "label": "4:00 PM – 6:00 PM"},
        "avoid": {"start": 11.5, "end": 15.0, "label": "11:30 AM – 3:00 PM", "reason": "Extreme UV radiation and choppy onshore wind blowout."},
        "focus": "wave surface texture, coastal wind, and solar exposure",
        "expected": "26°C, gentle 12 km/h offshore breeze, moderate swell, safe UV"
    },
    "agriculture": {
        "morning": {"start": 6.5, "end": 8.5, "label": "6:30 AM – 8:30 AM"},
        "afternoon": {"start": 17.0, "end": 18.5, "label": "5:00 PM – 6:30 PM"},
        "avoid": {"start": 11.0, "end": 14.5, "label": "11:00 AM – 2:30 PM", "reason": "High solar evaporation wastes moisture and risks foliage heat shock."},
        "focus": "soil hydration, plant transpiration, and moisture conservation",
        "expected": "Optimal soil absorption, low evaporation, minimal leaf burn risk"
    },
    "family": {
        "morning": {"start": 9.0, "end": 11.0, "label": "9:00 AM – 11:00 AM"},
        "afternoon": {"start": 16.5, "end": 18.5, "label": "4:30 PM – 6:30 PM"},
        "avoid": {"start": 12.0, "end": 15.5, "label": "12:00 PM – 3:30 PM", "reason": "Midday heat index and direct UV unsafe for children's outdoor play."},
        "focus": "outdoor playtime comfort and rain avoidance",
        "expected": "24°C, mild sun, shaded playground comfort, 0% rain"
    }
}

def calculate_time_windows(current_hour: float, persona_id: str = "fitness"):
    sched = PERSONA_SCHEDULES.get(persona_id, PERSONA_SCHEDULES["fitness"])
    m_start = sched["morning"]["start"]
    m_end = sched["morning"]["end"]
    m_label = sched["morning"]["label"]

    a_start = sched["afternoon"]["start"]
    a_end = sched["afternoon"]["end"]
    a_label = sched["afternoon"]["label"]

    av_start = sched["avoid"]["start"]
    av_end = sched["avoid"]["end"]
    av_label = sched["avoid"]["label"]

    if current_hour < m_end:
        if current_hour < m_start:
            diff_hours = int(m_start - current_hour)
            diff_mins = int(((m_start - current_hour) * 60) % 60)
            rel = f"Today • in {diff_hours}h {diff_mins}m" if diff_hours > 0 else f"Today • in {diff_mins}m"
        else:
            rel = "Active Now"
        best_window = m_label
        best_day_tag = "Today"
        is_today = True
    elif current_hour < a_end:
        if current_hour < a_start:
            diff_hours = int(a_start - current_hour)
            diff_mins = int(((a_start - current_hour) * 60) % 60)
            rel = f"Today • in {diff_hours}h {diff_mins}m" if diff_hours > 0 else f"Today • in {diff_mins}m"
        else:
            rel = "Active Now"
        best_window = a_label
        best_day_tag = "Today"
        is_today = True
    else:
        hours_until = int((24 - current_hour) + m_start)
        best_window = f"Tomorrow, {m_label}"
        best_day_tag = "Tomorrow"
        rel = f"Tomorrow • in {hours_until}h"
        is_today = False

    if current_hour < av_end:
        if current_hour < av_start:
            diff_h = int(av_start - current_hour)
            avoid_rel = f"Today • in {diff_h}h"
        else:
            avoid_rel = "Active Now"
        avoid_window = av_label
        avoid_day_tag = "Today"
    else:
        hours_until_avoid = int((24 - current_hour) + av_start)
        avoid_window = f"Tomorrow, {av_label}"
        avoid_day_tag = "Tomorrow"
        avoid_rel = f"Tomorrow • in {hours_until_avoid}h"

    return {
        "best_window": best_window,
        "best_day_tag": best_day_tag,
        "best_relative": rel,
        "is_today": is_today,
        "avoid_window": avoid_window,
        "avoid_day_tag": avoid_day_tag,
        "avoid_relative": avoid_rel,
        "avoid_reason": sched["avoid"]["reason"],
        "expected_conditions": sched["expected"]
    }

@router.post("")
def generate_persona_insights(req: PersonaInsightsRequest):
    weather = req.weatherData
    temp = float(weather.get("temp", 28))
    humidity = float(weather.get("humidity", 65))
    wind = float(weather.get("wind", 12))
    precip = float(weather.get("precip", 0.0))
    rain_chance = float(weather.get("rainChance", 10))
    aqi = float(weather.get("aqi", 65))
    uv = float(weather.get("uv", 6.5))
    location = weather.get("location", "Current Location")
    condition = weather.get("condition", "Clear")
    temp_unit = req.tempUnit.upper() if req.tempUnit else "C"
    wind_unit = "mph" if req.windUnit == "mph" else "km/h"

    # Current time extraction
    curr_hour = 10.0
    if req.clientCurrentTime:
        try:
            parts = req.clientCurrentTime.split(":")
            curr_hour = float(parts[0]) + float(parts[1]) / 60.0
        except Exception:
            pass

    time_calc = calculate_time_windows(curr_hour, req.personaId)

    persona_label = req.personaConfig.label if req.personaConfig else req.personaId.capitalize()
    score_label = req.personaConfig.scoreLabel if req.personaConfig else "Score"
    focus = req.personaConfig.primaryFocus if req.personaConfig else "weather conditions"

    # Build metric keys list
    metric_keys = [m.key for m in req.personaConfig.metrics] if req.personaConfig and req.personaConfig.metrics else ["temperature", "humidity", "wind", "rain"]

    # Try Groq API if key present
    api_key = os.environ.get("GROQ_API_KEY", "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")
    if api_key:
        try:
            import urllib.request
            prompt = f"""You are Mausam AI meteorologist.
Analyze current weather data for the active persona: {persona_label} (Focus: {focus}).
Current Time: {int(curr_hour)}:{int((curr_hour%1)*60):02d}.
Conditions at {location}:
- Condition: {condition}
- Temperature: {temp}°{temp_unit}
- Humidity: {humidity}%
- Wind: {wind} {wind_unit}
- Rain Chance: {rain_chance}% ({precip} mm)
- AQI: {aqi}
- UV Index: {uv}

Metrics to evaluate: {', '.join(metric_keys)}
Best Window scheduled: {time_calc['best_window']} ({time_calc['best_relative']})
Avoid Window: {time_calc['avoid_window']}

Return strictly valid JSON with no markdown and no backticks:
{{
  "metric_notes": {{
    "temperature": "Short concise note without repeating the number (e.g. 'Moderately warm for aerobic training')",
    "humidity": "Short concise note without repeating the number",
    "wind": "Short concise note without repeating the number",
    "rain": "Short concise note without repeating the number",
    "uv": "Short concise note without repeating the number",
    "aqi": "Short concise note without repeating the number"
  }},
  "score": 88,
  "score_reason": "One concise sentence explaining the score",
  "expected_conditions": "Short summary of expected temp, humidity, wind & rain during the best window",
  "avoid_reason": "One concise sentence explaining why to avoid that window"
}}"""
            groq_req_data = json.dumps({
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "system", "content": "You are a precise weather intelligence engine. Output only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.2,
                "response_format": {"type": "json_object"}
            }).encode("utf-8")

            url_req = urllib.request.Request(
                "https://api.groq.com/openai/v1/chat/completions",
                data=groq_req_data,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key.strip()}"
                },
                method="POST"
            )
            with urllib.request.urlopen(url_req, timeout=5) as response:
                if response.status == 200:
                    resp_json = json.loads(response.read().decode("utf-8"))
                    content = resp_json["choices"][0]["message"]["content"]
                    parsed = json.loads(content)

                    return {
                        "persona_id": req.personaId,
                        "persona_label": persona_label,
                        "score_label": score_label,
                        "score": int(parsed.get("score", 85)),
                        "score_reason": parsed.get("score_reason", "Comfortable atmospheric balance for session."),
                        "best_window": time_calc["best_window"],
                        "best_day_tag": time_calc["best_day_tag"],
                        "best_relative": time_calc["best_relative"],
                        "is_today": time_calc["is_today"],
                        "expected_conditions": parsed.get("expected_conditions", f"{round(temp-3)}°{temp_unit}, 55% humidity, calm breeze"),
                        "avoid_window": time_calc["avoid_window"],
                        "avoid_day_tag": time_calc["avoid_day_tag"],
                        "avoid_relative": time_calc["avoid_relative"],
                        "avoid_reason": parsed.get("avoid_reason", "High midday UV and thermal accumulation."),
                        "metric_notes": parsed.get("metric_notes", {}),
                        "source": "backend-groq"
                    }
        except Exception as e:
            print(f"Backend Groq call failed: {e}")

    # Deterministic fallback calculation
    computed_score = max(40, min(96, round(95 - abs(temp - 22) * 1.5 - (humidity - 60) * 0.3 if humidity > 60 else 0 - rain_chance * 0.3)))
    return {
        "persona_id": req.personaId,
        "persona_label": persona_label,
        "score_label": score_label,
        "score": computed_score,
        "score_reason": "Optimal morning temperature and light winds provide efficient conditions.",
        "best_window": time_calc["best_window"],
        "best_day_tag": time_calc["best_day_tag"],
        "best_relative": time_calc["best_relative"],
        "is_today": time_calc["is_today"],
        "expected_conditions": f"{round(temp-3)}°{temp_unit}, 55% humidity, calm breeze, 0% rain",
        "avoid_window": time_calc["avoid_window"],
        "avoid_day_tag": time_calc["avoid_day_tag"],
        "avoid_relative": time_calc["avoid_relative"],
        "avoid_reason": "Peak solar irradiance and elevated midday temperature.",
        "metric_notes": {
            "temperature": "Optimal thermal balance for pacing" if 16 <= temp <= 26 else "Warm conditions, manage hydration",
            "humidity": "Comfortable moisture levels" if humidity <= 65 else "Elevated moisture may feel muggy",
            "wind": "Comfortable aerodynamic conditions" if wind <= 18 else "Noticeable wind resistance",
            "rain": "Low precipitation risk" if rain_chance <= 20 else "Scattered showers expected",
            "uv": "Safe UV exposure" if uv <= 5 else "Sun protection recommended",
            "aqi": "Clean air quality" if aqi <= 100 else "Moderate air quality"
        },
        "source": "backend-computed"
    }
