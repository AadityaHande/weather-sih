import { NextRequest, NextResponse } from "next/server";

interface CandidateWindow {
  id: string;
  period: "morning" | "afternoon" | "evening";
  start: number;
  end: number;
  label: string;
  scoreOffset: number;
  reason: string;
}

interface PersonaSchedule {
  morning: { start: number; end: number; label: string };
  afternoon: { start: number; end: number; label: string };
  avoid: { start: number; end: number; label: string; reason: string };
  focus: string;
  shortReason: string;
  candidates: CandidateWindow[];
}

const PERSONA_SCHEDULES: Record<string, PersonaSchedule> = {
  fitness: {
    morning: { start: 6.0, end: 7.5, label: "6:00–7:30 AM" },
    afternoon: { start: 17.5, end: 19.0, label: "5:30–7:00 PM" },
    avoid: { start: 12.0, end: 15.5, label: "12:00–3:30 PM", reason: "Midday heat & peak UV" },
    focus: "aerobic pacing and thermal load",
    shortReason: "Cool air & gentle breeze",
    candidates: [
      { id: "morning_prime", period: "morning", start: 6.0, end: 7.5, label: "6:00–7:30 AM", scoreOffset: 0, reason: "Cool air & gentle breeze" },
      { id: "evening_sunset", period: "evening", start: 17.5, end: 19.0, label: "5:30–7:00 PM", scoreOffset: -4, reason: "Post-sunset cooling" },
      { id: "early_dawn", period: "morning", start: 5.0, end: 6.0, label: "5:00–6:00 AM", scoreOffset: -2, reason: "Lowest daily temperature" },
      { id: "late_evening", period: "evening", start: 19.5, end: 20.75, label: "7:30–8:45 PM", scoreOffset: -7, reason: "Zero solar UV radiation" },
    ],
  },
  health: {
    morning: { start: 9.5, end: 11.5, label: "9:30–11:30 AM" },
    afternoon: { start: 15.5, end: 17.0, label: "3:30–5:00 PM" },
    avoid: { start: 6.5, end: 8.5, label: "6:30–8:30 AM", reason: "Ground-level morning smog" },
    focus: "clean air and low particulate density",
    shortReason: "Dispersed PM2.5 & clean air",
    candidates: [
      { id: "mid_morning", period: "morning", start: 9.5, end: 11.5, label: "9:30–11:30 AM", scoreOffset: 0, reason: "Dispersed PM2.5 & clean air" },
      { id: "afternoon_clean", period: "afternoon", start: 15.5, end: 17.0, label: "3:30–5:00 PM", scoreOffset: -3, reason: "Fresh circulating air" },
      { id: "evening_fresh", period: "evening", start: 17.5, end: 19.0, label: "5:30–7:00 PM", scoreOffset: -5, reason: "Cooler balanced air" },
      { id: "early_afternoon", period: "afternoon", start: 13.0, end: 14.5, label: "1:00–2:30 PM", scoreOffset: -8, reason: "Low moisture & steady wind" },
    ],
  },
  traveler: {
    morning: { start: 10.0, end: 12.0, label: "10:00 AM–12:00 PM" },
    afternoon: { start: 13.5, end: 15.5, label: "1:30–3:30 PM" },
    avoid: { start: 8.0, end: 9.5, label: "8:00–9:30 AM", reason: "Rush hour traffic delays" },
    focus: "clear roads and transit flow",
    shortReason: "Clear roads & dry transit",
    candidates: [
      { id: "post_rush_morning", period: "morning", start: 10.0, end: 12.0, label: "10:00 AM–12:00 PM", scoreOffset: 0, reason: "Clear roads & dry transit" },
      { id: "afternoon_offpeak", period: "afternoon", start: 13.5, end: 15.5, label: "1:30–3:30 PM", scoreOffset: -3, reason: "Free-flowing highway lanes" },
      { id: "post_rush_night", period: "evening", start: 20.0, end: 21.5, label: "8:00–9:30 PM", scoreOffset: -5, reason: "Minimal evening traffic volume" },
      { id: "early_morning", period: "morning", start: 6.0, end: 7.3, label: "6:00–7:15 AM", scoreOffset: -6, reason: "Pre-rush hour clear lanes" },
    ],
  },
  beach: {
    morning: { start: 7.5, end: 10.0, label: "7:30–10:00 AM" },
    afternoon: { start: 16.0, end: 18.0, label: "4:00–6:00 PM" },
    avoid: { start: 11.5, end: 15.0, label: "11:30 AM–3:00 PM", reason: "Choppy winds & intense UV" },
    focus: "offshore breeze and gentle surf",
    shortReason: "Offshore breeze & mild sun",
    candidates: [
      { id: "morning_glass", period: "morning", start: 7.5, end: 10.0, label: "7:30–10:00 AM", scoreOffset: 0, reason: "Offshore breeze & mild sun" },
      { id: "afternoon_tide", period: "afternoon", start: 16.0, end: 18.0, label: "4:00–6:00 PM", scoreOffset: -4, reason: "Clean swell & low sun angle" },
      { id: "dawn_patrol", period: "morning", start: 6.0, end: 7.25, label: "6:00–7:15 AM", scoreOffset: -3, reason: "Glassy water surface" },
      { id: "sunset_coastal", period: "evening", start: 18.0, end: 19.25, label: "6:00–7:15 PM", scoreOffset: -7, reason: "Calm coastal twilight" },
    ],
  },
  agriculture: {
    morning: { start: 6.5, end: 8.5, label: "6:30–8:30 AM" },
    afternoon: { start: 17.0, end: 18.5, label: "5:00–6:30 PM" },
    avoid: { start: 11.0, end: 14.5, label: "11:00 AM–2:30 PM", reason: "High evaporation heat" },
    focus: "deep root moisture and low evaporation",
    shortReason: "Deep soil root uptake",
    candidates: [
      { id: "morning_root", period: "morning", start: 6.5, end: 8.5, label: "6:30–8:30 AM", scoreOffset: 0, reason: "Deep soil root uptake" },
      { id: "evening_soak", period: "evening", start: 17.0, end: 18.5, label: "5:00–6:30 PM", scoreOffset: -4, reason: "Moisture retention overnight" },
      { id: "dawn_mist", period: "morning", start: 5.5, end: 6.5, label: "5:30–6:30 AM", scoreOffset: -3, reason: "Zero solar evaporation" },
      { id: "cloud_afternoon", period: "afternoon", start: 14.0, end: 15.5, label: "2:00–3:30 PM", scoreOffset: -9, reason: "Diffused solar watering" },
    ],
  },
  family: {
    morning: { start: 9.0, end: 11.0, label: "9:00–11:00 AM" },
    afternoon: { start: 16.5, end: 18.5, label: "4:30–6:30 PM" },
    avoid: { start: 12.0, end: 15.5, label: "12:00–3:30 PM", reason: "Peak heat & direct UV" },
    focus: "shaded park play comfort",
    shortReason: "Mild park playtime weather",
    candidates: [
      { id: "morning_park", period: "morning", start: 9.0, end: 11.0, label: "9:00–11:00 AM", scoreOffset: 0, reason: "Mild park playtime weather" },
      { id: "afternoon_shade", period: "afternoon", start: 16.5, end: 18.5, label: "4:30–6:30 PM", scoreOffset: -3, reason: "Shaded park playground" },
      { id: "early_morning_walk", period: "morning", start: 8.0, end: 9.25, label: "8:00–9:15 AM", scoreOffset: -5, reason: "Quiet morning park grounds" },
      { id: "sunset_stroll", period: "evening", start: 18.5, end: 19.75, label: "6:30–7:45 PM", scoreOffset: -6, reason: "Comfortable evening breeze" },
    ],
  },
};

function cleanUnderLimit(text: string, maxLen: number = 36): string {
  if (!text) return "";
  let clean = text.replace(/^(Current\s|Optimal\s|Conditions:\s)/i, "").trim();
  clean = clean.replace(/\.{2,}$/, "").replace(/\.$/, "").trim();
  if (clean.length <= maxLen) return clean;
  const sub = clean.slice(0, maxLen);
  const lastSpace = sub.lastIndexOf(" ");
  return (lastSpace > 14 ? sub.slice(0, lastSpace) : sub).trim();
}

function calculateDynamicTimeWindows(
  clientHourFloat: number,
  personaId: string,
  excludeWindow?: string,
  constraint?: string
) {
  const sched = PERSONA_SCHEDULES[personaId] || PERSONA_SCHEDULES.fitness;

  // Filter candidates by constraint if specified
  let candidates = [...sched.candidates];
  if (constraint && constraint !== "all") {
    const periodMatches = candidates.filter((c) => c.period === constraint);
    if (periodMatches.length > 0) {
      candidates = periodMatches;
    }
  }

  // Exclude current window if specified
  if (excludeWindow) {
    const remaining = candidates.filter(
      (c) => !c.label.includes(excludeWindow) && !excludeWindow.includes(c.label)
    );
    if (remaining.length > 0) {
      candidates = remaining;
    }
  }

  const chosen = candidates[0];

  let best_window = chosen.label;
  let best_day_tag = "Today";
  let best_relative = "Today";
  let is_today = true;

  if (clientHourFloat < chosen.end) {
    if (clientHourFloat < chosen.start) {
      const diffHours = Math.floor(chosen.start - clientHourFloat);
      const diffMins = Math.round(((chosen.start - clientHourFloat) * 60) % 60);
      best_relative = diffHours > 0 ? `Today • in ${diffHours}h ${diffMins}m` : `Today • in ${diffMins}m`;
    } else {
      best_relative = "Active Now";
    }
    best_window = chosen.label;
    best_day_tag = "Today";
    is_today = true;
  } else {
    const hoursUntil = Math.round((24 - clientHourFloat) + chosen.start);
    best_window = `Tomorrow, ${chosen.label}`;
    best_day_tag = "Tomorrow";
    best_relative = `Tomorrow • in ${hoursUntil}h`;
    is_today = false;
  }

  // Avoid window calculation
  let avoid_window = sched.avoid.label;
  let avoid_day_tag = "Today";
  let avoid_relative = "Today";

  if (clientHourFloat < sched.avoid.end) {
    if (clientHourFloat < sched.avoid.start) {
      const diffH = Math.floor(sched.avoid.start - clientHourFloat);
      avoid_relative = `Today • in ${diffH}h`;
    } else {
      avoid_relative = "Active Now";
    }
    avoid_window = sched.avoid.label;
    avoid_day_tag = "Today";
  } else {
    const hoursUntilAvoid = Math.round((24 - clientHourFloat) + sched.avoid.start);
    avoid_window = `Tomorrow, ${sched.avoid.label}`;
    avoid_day_tag = "Tomorrow";
    avoid_relative = `Tomorrow • in ${hoursUntilAvoid}h`;
  }

  // Build full candidate list for client fast-switching
  const formattedCandidates = sched.candidates.map((c) => {
    const isTodayCandidate = clientHourFloat < c.end;
    const hoursUntilCand = isTodayCandidate
      ? Math.max(0, Math.floor(c.start - clientHourFloat))
      : Math.round((24 - clientHourFloat) + c.start);
    return {
      id: c.id,
      period: c.period,
      time_window: isTodayCandidate ? c.label : `Tomorrow, ${c.label}`,
      relative_tag: isTodayCandidate
        ? clientHourFloat < c.start ? `Today • in ${hoursUntilCand}h` : "Active Now"
        : `Tomorrow • in ${hoursUntilCand}h`,
      score_offset: c.scoreOffset,
      short_reason: c.reason,
    };
  });

  return {
    best_window,
    best_day_tag,
    best_relative,
    is_today,
    avoid_window,
    avoid_day_tag,
    avoid_relative,
    avoid_reason: sched.avoid.reason,
    short_reason: chosen.reason,
    score_offset: chosen.scoreOffset,
    candidates: formattedCandidates,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      personaId = "fitness",
      personaConfig,
      weatherData = {},
      clientCurrentTime,
      tempUnit = "c",
      windUnit = "kmh",
      excludeWindow,
      constraint,
      userLanguage = "English",
      locale = "en",
    } = body;

    const temp = Number(weatherData.temp ?? 23);
    const humidity = Number(weatherData.humidity ?? 89);
    const wind = Number(weatherData.wind ?? 15.2);
    const rainChance = Number(weatherData.rainChance ?? 10);
    const aqi = Number(weatherData.aqi ?? 65);
    const uv = Number(weatherData.uv ?? 6.5);
    const location = weatherData.location || "Current Location";

    // Extract client time
    let clientHourFloat = 22.0;
    if (clientCurrentTime) {
      const [h, m] = clientCurrentTime.split(":").map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        clientHourFloat = h + m / 60;
      }
    } else {
      const now = new Date();
      clientHourFloat = now.getHours() + now.getMinutes() / 60;
    }

    const timeCalc = calculateDynamicTimeWindows(
      clientHourFloat,
      personaId,
      excludeWindow,
      constraint
    );

    const personaLabel = personaConfig?.label || personaId.charAt(0).toUpperCase() + personaId.slice(1);
    const scoreLabel = personaConfig?.scoreLabel || "Score";
    const primaryFocus = PERSONA_SCHEDULES[personaId]?.focus || personaConfig?.primaryFocus || "general weather";
    const metricsToEvaluate = personaConfig?.metrics?.map((m: any) => m.key) || [
      "temperature",
      "humidity",
      "wind",
      "rain",
    ];

    // Compute tailored score & short reasons
    let computedScore = 85;
    let computedReason = timeCalc.short_reason;

    if (personaId === "health") {
      computedScore = Math.max(35, Math.min(98, Math.round(98 - (aqi > 50 ? (aqi - 50) * 0.45 : 0) - (uv > 5 ? (uv - 5) * 5 : 0) - (humidity > 80 ? 6 : 0))));
      computedReason = aqi <= 50 ? "Clean air & safe PM2.5" : "Moderate air quality";
    } else if (personaId === "traveler") {
      computedScore = Math.max(45, Math.min(98, Math.round(96 - rainChance * 0.55 - (wind > 20 ? (wind - 20) * 1.2 : 0))));
      computedReason = "Dry roads & low rain chance";
    } else if (personaId === "fitness") {
      computedScore = Math.max(40, Math.min(96, Math.round(96 - Math.abs(temp - 18) * 1.6 - (humidity > 70 ? (humidity - 70) * 0.7 : 0) - rainChance * 0.4)));
      computedReason = humidity > 75 ? "Elevated humidity" : "Cool air & gentle breeze";
    } else if (personaId === "beach") {
      computedScore = Math.max(40, Math.min(98, Math.round(95 - (uv > 7 ? (uv - 7) * 4 : 0) - (wind > 22 ? (wind - 22) * 1.5 : 0) - rainChance * 0.4)));
      computedReason = "Offshore breeze & mild sun";
    } else if (personaId === "agriculture") {
      computedScore = Math.max(40, Math.min(98, Math.round(92 - (temp > 30 ? (temp - 30) * 1.5 : 0) - (wind > 25 ? 10 : 0))));
      computedReason = "Deep soil moisture uptake";
    } else if (personaId === "family") {
      computedScore = Math.max(40, Math.min(98, Math.round(95 - rainChance * 0.5 - (temp > 28 ? (temp - 28) * 2 : 0) - (uv > 7 ? (uv - 7) * 4 : 0))));
      computedReason = "Mild park playtime weather";
    }

    const apiKey =
      process.env.GROQ_API_KEY ||
      process.env.NEXT_PUBLIC_GROQ_API_KEY ||
      "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";

    const isNonEnglish = userLanguage && userLanguage.toLowerCase() !== "english";
    const langInstruction = isNonEnglish
      ? `CRITICAL LANGUAGE REQUIREMENT: All metric_notes values, score_reason, and avoid_reason MUST BE WRITTEN IN ${userLanguage} (use native script).`
      : `Respond in English.`;

    const systemPrompt = `You are Mausam AI meteorologist.
Analyze current atmospheric conditions for persona: "${personaLabel}" (${primaryFocus}).
Current Conditions: Temp ${temp}°${tempUnit.toUpperCase()}, Humidity ${humidity}%, Wind ${wind} ${windUnit}, Rain ${rainChance}%, AQI ${aqi}, UV ${uv}.
${langInstruction}

CRITICAL RULES:
1. Each metric_note must be UNDER 40 CHARACTERS. Complete short phrase only.
2. "score_reason": exactly 3 to 5 words max.
3. "avoid_reason": exactly 3 to 5 words max.
4. "score": integer 40-98.

Output strictly valid JSON with no markdown and no backticks:
{
  "metric_notes": {
    "temperature": "short note",
    "humidity": "short note",
    "wind": "short note",
    "rain": "short note",
    "uv": "short note",
    "aqi": "short note"
  },
  "score": ${computedScore},
  "score_reason": "short reason",
  "avoid_reason": "short reason"
}`;

    if (apiKey) {
      const modelsToTry = [
        "qwen/qwen3.8-27b",
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "llama-3.3-70b-versatile",
      ];

      for (const modelName of modelsToTry) {
        try {
          const groqRes = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey.trim()}`,
              },
              body: JSON.stringify({
                model: modelName,
                messages: [
                  { role: "system", content: "You are a concise weather API. Return only raw JSON adhering strictly to character limits." },
                  { role: "user", content: systemPrompt },
                ],
                temperature: 0.2,
                max_tokens: 350,
                response_format: { type: "json_object" },
              }),
              signal: AbortSignal.timeout(3500),
            }
          );

          if (groqRes.ok) {
            const data = await groqRes.json();
            const rawContent = data.choices?.[0]?.message?.content;
            if (rawContent) {
              const parsed = JSON.parse(rawContent);

              // Sanitize all notes to guarantee character limit
              const sanitizedNotes: Record<string, string> = {};
              if (parsed.metric_notes) {
                for (const [k, v] of Object.entries(parsed.metric_notes)) {
                  sanitizedNotes[k] = cleanUnderLimit(String(v), 45);
                }
              }

              return NextResponse.json({
                persona_id: personaId,
                persona_label: personaLabel,
                score_label: scoreLabel,
                score: Number(parsed.score) || computedScore,
                score_reason: cleanUnderLimit(parsed.score_reason || computedReason, 40),
                best_window: timeCalc.best_window,
                best_day_tag: timeCalc.best_day_tag,
                best_relative: timeCalc.best_relative,
                is_today: timeCalc.is_today,
                avoid_window: timeCalc.avoid_window,
                avoid_day_tag: timeCalc.avoid_day_tag,
                avoid_relative: timeCalc.avoid_relative,
                avoid_reason: cleanUnderLimit(parsed.avoid_reason || timeCalc.avoid_reason, 40),
                metric_notes: sanitizedNotes,
                candidates: timeCalc.candidates,
                source: `groq-${modelName}`,
              });
            }
          }
        } catch (e) {
          // Fall through to next model
        }
      }
    }

    // High quality deterministic fallback with guaranteed <34 char notes
    return NextResponse.json({
      persona_id: personaId,
      persona_label: personaLabel,
      score_label: scoreLabel,
      score: computedScore + timeCalc.score_offset,
      score_reason: computedReason,
      best_window: timeCalc.best_window,
      best_day_tag: timeCalc.best_day_tag,
      best_relative: timeCalc.best_relative,
      is_today: timeCalc.is_today,
      avoid_window: timeCalc.avoid_window,
      avoid_day_tag: timeCalc.avoid_day_tag,
      avoid_relative: timeCalc.avoid_relative,
      avoid_reason: timeCalc.avoid_reason,
      candidates: timeCalc.candidates,
      metric_notes: {
        temperature: temp > 28 ? "Warm conditions" : "Ideal thermal balance",
        humidity: humidity > 70 ? "Elevated moisture" : "Comfortable moisture",
        wind: wind > 20 ? "Moderate resistance" : "Light gentle breeze",
        rain: rainChance > 25 ? "Scattered rain risk" : "Dry conditions expected",
        uv: uv > 6 ? "High UV intensity" : "Safe UV radiation",
        aqi: aqi > 100 ? "Moderate air quality" : "Clean breathing air",
      },
      source: "computed",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to generate persona insights" },
      { status: 500 }
    );
  }
}
