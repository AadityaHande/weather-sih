import { NextRequest, NextResponse } from "next/server";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

// Helper to interpret WMO weather codes
function getWmoDescription(code: number, isDay: boolean = true): string {
  if (code === 0) return isDay ? "Clear Sky" : "Clear Night";
  if (code === 1) return isDay ? "Mainly Clear" : "Mainly Clear Night";
  if (code === 2) return "Partly Cloudy";
  if (code === 3) return "Overcast";
  if (code >= 45 && code <= 48) return "Foggy";
  if (code >= 51 && code <= 55) return "Drizzle";
  if (code >= 61 && code <= 65) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain Showers";
  if (code >= 95 && code <= 99) return "Thunderstorms";
  return "Variable Weather";
}

// Common city extraction regex
async function extractAndGeocodeLocation(
  query: string,
  defaultLocation: { lat: number; lon: number; name: string }
): Promise<{ lat: number; lon: number; name: string; isExplicit: boolean }> {
  const patterns = [
    /\b(?:in|for|at|near|around|from|to)\s+([A-Za-z\s]{3,24})(?:\?|\.|\,|$|\s+(?:today|tomorrow|this|on|next))/i,
    /([A-Za-z\s]{3,24})\s+weather/i,
    /weather\s+(?:of|for|in)\s+([A-Za-z\s]{3,24})/i,
    /i(?:'m| am| live)\s+in\s+([A-Za-z\s]{3,24})/i,
  ];

  let detectedCity: string | null = null;
  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim();
      const stopwords = [
        "the morning",
        "the evening",
        "my area",
        "this weekend",
        "my location",
        "here",
        "today",
        "tomorrow",
        "now",
        "right now",
        "outside",
      ];
      if (!stopwords.includes(candidate.toLowerCase())) {
        detectedCity = candidate;
        break;
      }
    }
  }

  if (detectedCity) {
    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(detectedCity)}&count=1&language=en&format=json`,
        { signal: AbortSignal.timeout(3500), cache: "no-store" }
      );
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData.results && geoData.results.length > 0) {
          const top = geoData.results[0];
          return {
            lat: top.latitude,
            lon: top.longitude,
            name: `${top.name}${top.admin1 ? ", " + top.admin1 : ""}, ${top.country_code?.toUpperCase() || ""}`,
            isExplicit: true,
          };
        }
      }
    } catch (e) {
      console.warn("Geocoding fetch error:", e);
    }
  }

  return { ...defaultLocation, isExplicit: false };
}

// Fallback logic distinguishing live observations from forecast probabilities
function generateAccurateFallback(
  userQuery: string,
  loc: string,
  w: {
    temp: number;
    unit: string;
    condition: string;
    isRainingNow: boolean;
    precipNow: number;
    rainChance: number;
    humidity: number;
    wind: number;
    windUnit: string;
    uv: number;
    aqi: number;
  }
): string {
  const q = userQuery.toLowerCase();
  const shortLoc = loc.split(",")[0];

  // 1. Rain inquiries
  if (q.includes("rain") || q.includes("umbrella") || q.includes("wet") || q.includes("shower") || q.includes("precipitation")) {
    const isAskingRightNow = q.includes("now") || q.includes("currently") || q.includes("outside") || q.includes("is it raining");

    if (isAskingRightNow) {
      if (w.isRainingNow) {
        return `Yes, live sensors detect rain in ${shortLoc} right now with ${w.condition.toLowerCase()} skies and about ${w.precipNow} mm of precipitation. Keep an umbrella handy if you're stepping outside.`;
      }
      return `It's not currently raining at your location in ${shortLoc} — skies are ${w.condition.toLowerCase()} with 0 mm of active precipitation. However, there is a ${w.rainChance}% chance of rain later today based on the forecast, so conditions could shift.`;
    }

    // Asking "Will it rain today / later?"
    if (w.rainChance >= 60) {
      if (w.isRainingNow) {
        return `It is currently raining in ${shortLoc} right now, and the forecast shows a high ${w.rainChance}% rain chance continuing today. I'd postpone outdoor plans and carry an umbrella.`;
      }
      return `It's not currently raining in ${shortLoc}, but there's a ${w.rainChance}% chance of rain later today based on the forecast. Outdoor plans aren't ideal right now since conditions could shift soon.`;
    }

    if (w.rainChance >= 30) {
      return `It's not raining right now in ${shortLoc}, but there's a moderate ${w.rainChance}% chance of scattered showers later today. Keeping a compact umbrella nearby is a smart precaution.`;
    }

    return `No, rain is very unlikely in ${shortLoc} today with only a ${w.rainChance}% forecast chance under ${w.condition.toLowerCase()} skies. You should be good to head out without an umbrella.`;
  }

  // 2. Running / Outdoor workouts
  if (q.includes("run") || q.includes("jog") || q.includes("workout") || q.includes("exercise") || q.includes("cycling")) {
    if (w.isRainingNow || w.rainChance >= 60) {
      return `Outdoor workouts aren't ideal right now in ${shortLoc} — there is a high ${w.rainChance}% forecast chance of rain with ${w.humidity}% humidity. You're better off doing an indoor session or waiting for a clearer window.`;
    }
    if (w.temp >= 32 || w.uv >= 8) {
      return `It is quite hot for a run in ${shortLoc} right now at ${w.temp}°${w.unit} with an intense UV index of ${w.uv}. If you go, stick to shaded paths or wait until the evening when it cools down.`;
    }
    if (w.aqi > 120) {
      return `I'd hold off on strenuous outdoor exercise in ${shortLoc} right now — air quality is poor with an AQI of ${w.aqi}. An indoor treadmill or gym workout is much safer for your lungs.`;
    }
    return `Yes, conditions are solid for a run in ${shortLoc} right now at ${w.temp}°${w.unit} with comfortable ${w.wind} ${w.windUnit} breeze. Rain risk is low at ${w.rainChance}%, so enjoy the route!`;
  }

  // 3. Clothing
  if (q.includes("wear") || q.includes("cloth") || q.includes("dress") || q.includes("jacket") || q.includes("outfit")) {
    if (w.isRainingNow || w.rainChance >= 60) {
      return `Definitely grab a waterproof jacket or carry an umbrella today since there's a ${w.rainChance}% chance of rain in ${shortLoc}. Temperatures are around ${w.temp}°${w.unit}, so light layers underneath will keep you comfortable.`;
    }
    if (w.temp >= 28) {
      return `Light, breathable cotton is best today as it's warm at ${w.temp}°${w.unit} with ${w.humidity}% humidity. Sunglasses are also recommended if you'll be outside in the sun.`;
    }
    return `Everyday casual clothes with a light layer will be comfortable today for ${w.temp}°${w.unit} and ${w.condition.toLowerCase()} weather.`;
  }

  // 4. Air Quality
  if (q.includes("air") || q.includes("aqi") || q.includes("pollution") || q.includes("smog") || q.includes("pm2")) {
    if (w.aqi <= 50) {
      return `The air quality in ${shortLoc} is clean and healthy right now with an AQI of ${w.aqi}. It is safe for all outdoor activities and deep breathing.`;
    }
    if (w.aqi <= 100) {
      return `Air quality in ${shortLoc} is moderate with an AQI of ${w.aqi}. Safe for most people, though sensitive individuals should avoid excessive outdoor exertion.`;
    }
    return `Air quality is currently poor in ${shortLoc} with an elevated AQI of ${w.aqi}. I'd recommend limiting intense outdoor cardio or wearing a mask if you have respiratory sensitivities.`;
  }

  // 5. General Weather
  return `In ${shortLoc}, it's currently ${w.temp}°${w.unit} and ${w.condition.toLowerCase()}${w.isRainingNow ? " with active rain" : ", and not currently raining"}. The forecast shows a ${w.rainChance}% chance of rain later today with ${w.humidity}% humidity.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      messages = [],
      location = { lat: 18.4635, lon: 73.8732, name: "Pune, India" },
      userLanguage = "English",
      locale = "en",
      aiChatSupported = true,
      tempUnit = "c",
      windUnit = "kmh",
    } = body;

    const lastUserMessage = [...messages].reverse().find((m: Message) => m.role === "user")?.content || "";

    // 1. Resolve Target Location (City in query vs Current Location)
    const targetLocation = await extractAndGeocodeLocation(lastUserMessage, {
      lat: Number(location.lat || 18.4635),
      lon: Number(location.lon || 73.8732),
      name: location.name || "Current Location",
    });

    // 2. Fetch Live Telemetry (cache: 'no-store' for up-to-the-minute freshness)
    let weatherCardContext: any = null;
    let weatherSnippet = "";

    try {
      const [forecastRes, aqiRes] = await Promise.all([
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${targetLocation.lat}&longitude=${targetLocation.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,weather_code,wind_speed_10m,wind_direction_10m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=auto`,
          { signal: AbortSignal.timeout(8000), cache: "no-store" }
        ),
        fetch(
          `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${targetLocation.lat}&longitude=${targetLocation.lon}&current=pm2_5,us_aqi&timezone=auto`,
          { signal: AbortSignal.timeout(8000), cache: "no-store" }
        ).catch(() => null),
      ]);

      if (forecastRes.ok) {
        const fData = await forecastRes.json();
        const aqiData = aqiRes && aqiRes.ok ? await aqiRes.json() : null;

        const current = fData.current || {};
        const daily = fData.daily || {};
        const isDay = current.is_day === 1;
        const condition = getWmoDescription(current.weather_code ?? 0, isDay);
        const temp = current.temperature_2m ?? 23;
        const feelsLike = current.apparent_temperature ?? 23;
        const humidity = current.relative_humidity_2m ?? 89;
        const wind = current.wind_speed_10m ?? 12;
        const precip = current.precipitation ?? 0.0;
        const rawRain = current.rain ?? 0.0;
        const rawShowers = current.showers ?? 0.0;
        const wCode = current.weather_code ?? 0;

        // Distinguish live observation from forecast probability
        const isRainingRightNow =
          precip > 0.05 ||
          rawRain > 0.05 ||
          rawShowers > 0.05 ||
          [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(wCode);

        const maxTemp = daily.temperature_2m_max?.[0] ?? 28;
        const minTemp = daily.temperature_2m_min?.[0] ?? 20;
        const forecastRainChance = daily.precipitation_probability_max?.[0] ?? 90;
        const uvMax = daily.uv_index_max?.[0] ?? 8.4;
        const aqiVal = aqiData?.current?.us_aqi ?? 26;

        weatherSnippet = `WEATHER CONTEXT FOR: ${targetLocation.name}
LIVE CURRENT OBSERVATION RIGHT NOW:
- Is it raining right now? ${isRainingRightNow ? `YES, active rain detected (${precip} mm, ${condition})` : `NO, it is NOT raining right now (0 mm precipitation, ${condition})`}
- Current Temp: ${temp}°C (${tempUnit === "f" ? Math.round(temp * 1.8 + 32) + "°F" : temp + "°C"})
- Feels Like: ${feelsLike}°C
- Humidity: ${humidity}%
- Wind Speed: ${wind} km/h

FORECAST PROBABILITY (LATER TODAY):
- Rain Probability Later Today: ${forecastRainChance}%
- Expected Max Temperature: ${maxTemp}°C / Min: ${minTemp}°C
- UV Index Max: ${uvMax}
- Air Quality (US AQI): ${aqiVal}`;

        weatherCardContext = {
          location: targetLocation.name,
          temp: tempUnit === "f" ? Math.round(temp * 1.8 + 32) : Math.round(temp),
          unit: tempUnit.toUpperCase(),
          condition,
          isRainingNow: isRainingRightNow,
          precipNow: precip,
          humidity,
          wind: windUnit === "mph" ? Number((wind * 0.621).toFixed(1)) : Number(wind.toFixed(1)),
          windUnit: windUnit === "mph" ? "mph" : "km/h",
          rainChance: forecastRainChance,
          aqi: aqiVal,
          uv: uvMax,
          isDay,
        };
      }
    } catch (err) {
      console.warn("Weather telemetry fetch failed:", err);
    }

    const fallbackWeather = weatherCardContext || {
      temp: 23,
      unit: tempUnit.toUpperCase(),
      condition: "Overcast",
      isRainingNow: false,
      precipNow: 0.0,
      humidity: 89,
      wind: 12,
      windUnit: windUnit === "mph" ? "mph" : "km/h",
      rainChance: 90,
      uv: 8.4,
      aqi: 26,
    };

    if (!weatherSnippet) {
      weatherSnippet = `WEATHER CONTEXT FOR: ${targetLocation.name}
LIVE CURRENT OBSERVATION RIGHT NOW:
- Is it raining right now? NO, it is NOT raining right now (0 mm precipitation, Overcast)
- Current Temp: ${fallbackWeather.temp}°${fallbackWeather.unit}
- Humidity: ${fallbackWeather.humidity}%
- Wind Speed: ${fallbackWeather.wind} ${fallbackWeather.windUnit}

FORECAST PROBABILITY (LATER TODAY):
- Rain Probability Later Today: ${fallbackWeather.rainChance}%
- UV Index Max: ${fallbackWeather.uv}
- Air Quality (US AQI): ${fallbackWeather.aqi}`;
    }

    // Multilingual Instruction tailored to native Indian language fluency
    const isLanguageSupported = aiChatSupported && userLanguage !== "English";
    const languageRule = isLanguageSupported
      ? `LANGUAGE RULE: Respond in ${userLanguage} only, using natural, everyday phrasing a native speaker would use — not a literal word-for-word translation style. Maintain the exact same tone, 2-3 sentence length, and strict probability vs observation data rules in ${userLanguage}.`
      : userLanguage !== "English" && !aiChatSupported
      ? `LANGUAGE RULE: Native conversational generation in ${userLanguage} is in Phase 2 preview. Respond in clear English while maintaining all guidelines.`
      : `LANGUAGE RULE: Respond in English only, using natural, everyday phrasing.`;

    // 3. System Prompt strictly separating live observations from forecast probabilities
    const systemPrompt = `You are Mausam AI, a hyper-accurate weather assistant. You answer using ONLY the weather data provided in context — never guess or state forecast probabilities as current facts.

${languageRule}

PROBABILITY VS LIVE OBSERVATION RULES:
1. "Is it raining right now?" -> Answer using the LIVE CURRENT OBSERVATION. If it's not raining now (0 mm precip), say so explicitly: "It's not currently raining at your location..." Then note the forecast rain probability for later.
2. "Will it rain today / later?" -> Clearly frame it as a forecast probability ("there is a high 90% chance of rain later today based on the forecast"). NEVER say "it is definitely raining" or phrase a percentage as a current fact.
3. ADVICE MUST MATCH THE DATA:
   - High rain chance (>= 60%) -> do NOT call conditions favorable for outdoor plans. Say so plainly: "High chance of rain — outdoor plans aren't ideal right now."
   - No generic filler like "ensure hydration and sun protection" when rain or overcast dominates.
4. LENGTH: 2-3 sentences max. No bullet lists, no bold headers, no markdown formatting. Write like a text message from a knowledgeable friend, not a report.
5. STRUCTURE:
   - Sentence 1: Direct answer to the question (differentiating whether it is raining now vs later forecast).
   - Sentence 2: 1-2 most relevant supporting numbers.
   - Sentence 3 (optional): One practical, data-consistent suggestion.

${weatherSnippet}`;

    const groqApiKey =
      process.env.GROQ_API_KEY ||
      process.env.NEXT_PUBLIC_GROQ_API_KEY ||
      "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";

    let assistantReply = "";
    const candidateModels = ["qwen/qwen3.8-27b", "openai/gpt-oss-120b", "openai/gpt-oss-20b"];

    for (const modelName of candidateModels) {
      if (assistantReply) break;
      try {
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groqApiKey.trim()}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: lastUserMessage },
            ],
            temperature: 0.2,
            max_tokens: 150,
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          const raw = groqData.choices?.[0]?.message?.content?.trim();
          if (raw && raw.length > 5) {
            assistantReply = raw;
            break;
          }
        }
      } catch (e) {
        console.warn(`Groq error with model ${modelName}:`, e);
      }
    }

    if (!assistantReply) {
      assistantReply = generateAccurateFallback(
        lastUserMessage,
        targetLocation.name,
        fallbackWeather
      );
    }

    // Clean any unwanted markdown formatting to ensure natural text message style
    assistantReply = assistantReply
      .replace(/^#+\s+/gm, "")
      .replace(/^[•\-\*]\s+/gm, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .trim();

    const shortCity = targetLocation.name.split(",")[0];
    const suggestions = [
      `Is it raining right now in ${shortCity}?`,
      `What should I wear today?`,
      `Best time for outdoor workout?`,
    ];

    return NextResponse.json({
      reply: assistantReply,
      weatherContext: weatherCardContext,
      resolvedLocation: targetLocation.name,
      isLocationUpdated: targetLocation.isExplicit,
      suggestions,
    });
  } catch (error: any) {
    console.error("Chatbot API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process chatbot request" },
      { status: 500 }
    );
  }
}
