// A tool can call any API. This one uses Open-Meteo (https://open-meteo.com):
// free, and no API key needed.

// WMO weather codes, as returned by Open-Meteo in `weather_code`.
const CONDITIONS = {
  0: "clear sky",
  1: "mainly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "fog",
  48: "depositing rime fog",
  51: "light drizzle",
  53: "moderate drizzle",
  55: "dense drizzle",
  56: "light freezing drizzle",
  57: "dense freezing drizzle",
  61: "slight rain",
  63: "moderate rain",
  65: "heavy rain",
  66: "light freezing rain",
  67: "heavy freezing rain",
  71: "slight snowfall",
  73: "moderate snowfall",
  75: "heavy snowfall",
  77: "snow grains",
  80: "slight rain showers",
  81: "moderate rain showers",
  82: "violent rain showers",
  85: "slight snow showers",
  86: "heavy snow showers",
  95: "thunderstorm",
  96: "thunderstorm with slight hail",
  99: "thunderstorm with heavy hail",
};

export const getWeather = {
  definition: {
    name: "get_weather",
    description:
      "Get the current weather for a city: temperature in °C, wind speed in km/h, conditions, " +
      "and the city's IANA time zone.",
    input_schema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name, e.g. 'Paris' or 'Tokyo'" },
      },
      required: ["city"],
      additionalProperties: false,
    },
    strict: true,
  },

  async run({ city }) {
    // Step 1: city name -> coordinates.
    const geo = await fetchJson(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`,
    );
    const place = geo.results?.[0];
    if (!place) throw new Error(`No city found named "${city}".`);

    // Step 2: coordinates -> current weather.
    const { current } = await fetchJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
        "&current=temperature_2m,wind_speed_10m,weather_code",
    );

    return {
      city: place.name,
      country: place.country,
      timezone: place.timezone,
      temperature_c: current.temperature_2m,
      wind_kmh: current.wind_speed_10m,
      conditions: CONDITIONS[current.weather_code] ?? `WMO weather code ${current.weather_code}`,
    };
  },
};

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Weather service answered HTTP ${response.status}.`);
  return response.json();
}
