/* Open-Meteo fallback — free, keyless, CORS-enabled.
   Mapped into the same shapes the app already consumes (OpenWeather API),
   so every data hook can transparently fall back when the key is missing,
   invalid, rate-limited, or the request otherwise fails. */

const FM = 'https://api.open-meteo.com/v1/forecast';
const AQ = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const GEO = 'https://geocoding-api.open-meteo.com/v1';

/* WMO weather code → OpenWeather (id, main, description) */
const WMO = {
  0: { id: 800, main: 'Clear', description: 'clear sky' },
  1: { id: 801, main: 'Clouds', description: 'mainly clear' },
  2: { id: 802, main: 'Clouds', description: 'partly cloudy' },
  3: { id: 803, main: 'Clouds', description: 'overcast' },
  45: { id: 701, main: 'Mist', description: 'fog' },
  48: { id: 741, main: 'Fog', description: 'depositing rime fog' },
  51: { id: 311, main: 'Drizzle', description: 'light drizzle' },
  53: { id: 310, main: 'Drizzle', description: 'drizzle' },
  55: { id: 321, main: 'Drizzle', description: 'heavy drizzle' },
  56: { id: 313, main: 'Drizzle', description: 'freezing drizzle' },
  57: { id: 314, main: 'Drizzle', description: 'heavy freezing drizzle' },
  61: { id: 501, main: 'Rain', description: 'light rain' },
  63: { id: 502, main: 'Rain', description: 'moderate rain' },
  65: { id: 503, main: 'Rain', description: 'heavy rain' },
  66: { id: 506, main: 'Rain', description: 'freezing rain' },
  67: { id: 506, main: 'Rain', description: 'freezing rain' },
  71: { id: 601, main: 'Snow', description: 'light snow' },
  73: { id: 602, main: 'Snow', description: 'snow' },
  75: { id: 603, main: 'Snow', description: 'heavy snow' },
  77: { id: 601, main: 'Snow', description: 'snow grains' },
  80: { id: 521, main: 'Rain', description: 'light showers' },
  81: { id: 522, main: 'Rain', description: 'showers' },
  82: { id: 503, main: 'Rain', description: 'violent showers' },
  85: { id: 611, main: 'Snow', description: 'snow showers' },
  86: { id: 612, main: 'Snow', description: 'heavy snow showers' },
  95: { id: 211, main: 'Thunderstorm', description: 'thunderstorm' },
  96: { id: 212, main: 'Thunderstorm', description: 'thunderstorm with hail' },
  99: { id: 212, main: 'Thunderstorm', description: 'thunderstorm with hail' },
};

/* WMO code → OpenWeather icon stem ('01'..'13') */
const WMO_ICON = {
  0: '01', 1: '02', 2: '03', 3: '04', 45: '50', 48: '50',
  51: '09', 53: '09', 55: '09', 56: '09', 57: '09',
  61: '10', 63: '10', 65: '10', 66: '10', 67: '10',
  71: '13', 73: '13', 75: '13', 77: '13',
  80: '09', 81: '09', 82: '09', 85: '13', 86: '13',
  95: '11', 96: '11', 99: '11',
};

const wx = (wmo, isDay) => {
  const w = WMO[wmo] || WMO[3];
  const icon = `${WMO_ICON[wmo] || '03'}${isDay ? 'd' : 'n'}`;
  return { id: w.id, main: w.main, description: w.description, icon };
};

const toUnix = (iso) => (iso ? Date.parse(iso) / 1000 : null);

export async function openMeteoCurrent(lat, lon) {
  const p = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current:
      'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,visibility,rain,snowfall',
    daily: 'temperature_2m_max,temperature_2m_min,sunrise,sunset',
    timezone: 'auto',
  });
  const d = await (await fetch(`${FM}?${p}`)).json();
  const c = d.current;
  const day = d.daily;

  return {
    coord: { lat: +lat, lon: +lon },
    weather: [wx(c.weather_code, c.is_day)],
    main: {
      temp: c.temperature_2m,
      feels_like: c.apparent_temperature,
      temp_min: day.temperature_2m_min[0],
      temp_max: day.temperature_2m_max[0],
      pressure: c.pressure_msl,
      humidity: c.relative_humidity_2m,
      sea_level: c.pressure_msl,
    },
    visibility: c.visibility ?? 10000,
    wind: {
      speed: c.wind_speed_10m,
      deg: c.wind_direction_10m,
      gust: c.wind_gusts_10m,
    },
    clouds: { all: c.cloud_cover },
    rain: c.rain ? { '1h': c.rain } : undefined,
    snow: c.snowfall ? { '1h': c.snowfall } : undefined,
    dt: toUnix(c.time),
    sys: {
      sunrise: toUnix(day.sunrise[0]),
      sunset: toUnix(day.sunset[0]),
      country: '',
    },
    timezone: d.utc_offset_seconds || 0,
    name: '',
    _source: 'open-meteo',
  };
}

export async function openMeteoForecast(lat, lon) {
  const p = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: 'temperature_2m,weather_code',
    hourly:
      'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,visibility,is_day,rain',
    daily: 'temperature_2m_max,temperature_2m_min,sunrise,sunset',
    timezone: 'auto',
    forecast_days: 6,
    forecast_hours: 120,
    alerts: 'true',
  });
  const d = await (await fetch(`${FM}?${p}`)).json();
  const h = d.hourly;

  const list = [];
  /* Open-Meteo is hourly; take every 3rd entry to mirror OWM's 3-hour blocks. */
  for (let i = 0; i < h.time.length; i += 3) {
    const isDay = h.is_day[i];
    list.push({
      dt: toUnix(h.time[i]),
      dt_txt: h.time[i],
      main: {
        temp: h.temperature_2m[i],
        feels_like: h.apparent_temperature[i],
        temp_min: h.temperature_2m[i],
        temp_max: h.temperature_2m[i],
        humidity: h.relative_humidity_2m[i],
      },
      weather: [wx(h.weather_code[i], isDay)],
      clouds: { all: h.cloud_cover[i] },
      wind: {
        speed: h.wind_speed_10m[i],
        deg: h.wind_direction_10m[i],
        gust: h.wind_gusts_10m[i],
      },
      visibility: h.visibility[i],
      pop: (h.precipitation_probability[i] ?? 0) / 100,
      rain: h.rain[i] ? { '3h': h.rain[i] } : undefined,
    });
  }

  return {
    list,
    city: { name: '', country: '' },
    alerts: (d.alerts || []).map((a) => ({
      event: a.title || 'Weather alert',
      start: toUnix(a.start),
      end: toUnix(a.end),
      description: a.description,
      severity: (a.severity || 'warning').toLowerCase(),
    })),
    _source: 'open-meteo',
  };
}

export async function openMeteoAirQuality(lat, lon) {
  /* Note: requesting `o3` (or larger combos) makes the air-quality API
     return 400 — so stick to the safe set. */
  const p = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: 'us_aqi,pm2_5,pm10',
    timezone: 'auto',
  });
  const d = await (await fetch(`${AQ}?${p}`)).json();
  const c = d.current;
  const us = c.us_aqi ?? 0;
  const aqi = us <= 50 ? 1 : us <= 100 ? 2 : us <= 150 ? 3 : us <= 200 ? 4 : 5;

  return {
    list: [
      {
        main: { aqi },
        components: {
          co: null,
          no: null,
          no2: null,
          o3: null,
          so2: null,
          pm2_5: c.pm2_5 ?? null,
          pm10: c.pm10 ?? null,
          nh3: null,
        },
      },
    ],
    _source: 'open-meteo',
  };
}

export async function openMeteoGeocode(query) {
  const d = await (
    await fetch(`${GEO}/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`)
  ).json();
  return (d.results || []).map((r) => ({
    name: r.name,
    lat: r.latitude,
    lon: r.longitude,
    country: r.country || '',
    state: r.admin1 || '',
  }));
}

/* Open-Meteo has no reverse-geocoding endpoint (404s), so the inverse
   geocode fallback uses BigDataCloud — keyless, CORS-enabled, and it can
   name oceans too. Mapped into the OWM [{ name, country }] shape. */
export async function bdcReverse(lat, lon) {
  const d = await (
    await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
    )
  ).json();
  const place =
    d.ocean || [d.locality, d.city, d.principalSubdivision, d.countryName].find(Boolean);
  if (!place) return [];
  return [{ name: place, country: d.countryName || '' }];
}
