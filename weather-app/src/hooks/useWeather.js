import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useWeatherStore } from '../store/weatherStore';
import {
  openMeteoCurrent,
  openMeteoForecast,
  openMeteoAirQuality,
  openMeteoGeocode,
  bdcReverse,
} from '../lib/openMeteo';

const API_KEY = import.meta.env.VITE_OPENWEATHER_KEY || '';
const BASE = 'https://api.openweathermap.org/data/2.5';
const GEO = 'https://api.openweathermap.org/geo/1.0';
const OM_FORECAST = 'https://api.open-meteo.com/v1/forecast';

const fetchJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
  return res.json();
};

/* Try OpenWeather first, silently fall back to keyless Open-Meteo.
   Every hook stays identical for consumers — the payload shapes match. */
const withFallback = (owmUrl, omFn) => async () => {
  if (!API_KEY) return omFn();
  try {
    return await fetchJson(owmUrl);
  } catch {
    return omFn();
  }
};

/* Weather alerts — OneCall is paid-only now (401 on free keys), so alerts
   always come from Open-Meteo's keyless feed. */
export const useAlerts = () => {
  const { location } = useWeatherStore();
  return useQuery({
    queryKey: ['alerts', location.lat, location.lon],
    queryFn: async () => {
      const p = new URLSearchParams({
        latitude: location.lat,
        longitude: location.lon,
        timezone: 'auto',
        forecast_days: 2,
        current: 'temperature_2m',
        alerts: 'true',
      });
      const d = await (await fetch(`${OM_FORECAST}?${p}`)).json();
      return (d.alerts || []).map((a) => ({
        event: a.title || 'Weather alert',
        start: Date.parse(a.start) / 1000,
        end: Date.parse(a.end) / 1000,
        description: a.description,
        severity: (a.severity || 'warning').toLowerCase(),
      }));
    },
    enabled: !!location?.lat && !!location?.lon,
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });
};

export const useAQI = () => {
  const { location } = useWeatherStore();
  return useQuery({
    queryKey: ['aqi', location.lat, location.lon],
    queryFn: withFallback(
      () => `${BASE}/air_pollution?lat=${location.lat}&lon=${location.lon}&appid=${API_KEY}`,
      () => openMeteoAirQuality(location.lat, location.lon)
    ),
    enabled: !!location?.lat && !!location?.lon,
    staleTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: 2,
  });
};

export const useUVIndex = () => {
  const { location } = useWeatherStore();
  return useQuery({
    queryKey: ['uv-index', location.lat, location.lon],
    queryFn: () =>
      fetchJson(
        `${BASE}/uvi/forecast?lat=${location.lat}&lon=${location.lon}&appid=${API_KEY}`
      ),
    enabled: !!API_KEY && !!location?.lat && !!location?.lon,
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });
};

export const useInverseGeocode = (lat, lon) => {
  return useQuery({
    queryKey: ['inverse-geocode', lat, lon],
    queryFn: withFallback(
      () => `${GEO}/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`,
      () => bdcReverse(lat, lon)
    ),
    enabled: !!lat && !!lon,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
};

export const useWeatherByCoords = (lat, lon) => {
  return useQuery({
    queryKey: ['weather', lat, lon],
    queryFn: withFallback(
      () => `${BASE}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`,
      () => openMeteoCurrent(lat, lon)
    ),
    enabled: !!lat && !!lon,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
};

export const useCurrentWeather = () => {
  const { location } = useWeatherStore();
  return useQuery({
    queryKey: ['weather', location.lat, location.lon],
    queryFn: withFallback(
      () => `${BASE}/weather?lat=${location.lat}&lon=${location.lon}&units=metric&appid=${API_KEY}`,
      () => openMeteoCurrent(location.lat, location.lon)
    ),
    enabled: !!location?.lat && !!location?.lon,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 2,
  });
};

/* One forecast query, shared by every consumer (3h blocks, 5-6 days). */
export const useForecast = () => {
  const { location } = useWeatherStore();
  return useQuery({
    queryKey: ['forecast', location.lat, location.lon],
    queryFn: withFallback(
      () => `${BASE}/forecast?lat=${location.lat}&lon=${location.lon}&units=metric&appid=${API_KEY}`,
      () => openMeteoForecast(location.lat, location.lon)
    ),
    enabled: !!location?.lat && !!location?.lon,
    staleTime: 15 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
    retry: 2,
  });
};

export const useMultiDayForecast = () => useForecast();

export const useForecastHrs = () => useForecast();

export const useCitySearch = (query) => {
  return useQuery({
    queryKey: ['city-search', query],
    queryFn: withFallback(
      () => `${GEO}/direct?q=${encodeURIComponent(query)}&limit=5&appid=${API_KEY}`,
      () => openMeteoGeocode(query)
    ),
    enabled: query?.length >= 2,
    staleTime: 60 * 60 * 1000,
  });
};

export const useGeolocation = () => {
  const { setLocation } = useWeatherStore();

  return useQuery({
    queryKey: ['geolocation'],
    queryFn: async () => {
      if (!navigator.geolocation) {
        throw new Error('Geolocation not supported');
      }

      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 600000,
        });
      });

      const { latitude: lat, longitude: lon } = pos.coords;

      let name = 'Current Location';
      try {
        const geo = API_KEY
          ? await fetchJson(`${GEO}/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`)
          : await bdcReverse(lat, lon);
        if (geo?.[0]?.name) {
          name = geo[0].name;
        }
      } catch {
        // reverse geocode failed, fall back to generic name
      }

      const location = { name, lat, lon };
      setLocation(location);
      return location;
    },
    enabled: false,
    retry: 0,
  });
};

export const useAQICategory = (aqi) => {
  if (aqi >= 300) return 'hazardous';
  if (aqi >= 250) return 'very-unhealthy';
  if (aqi >= 200) return 'unhealthy';
  if (aqi >= 150) return 'unhealthy-for-sensitive';
  if (aqi >= 100) return 'moderate';
  if (aqi >= 50) return 'good-for-sensitive';
  return 'good';
};

export const useUVCategory = (uv) => {
  if (uv >= 11) return 'extreme';
  if (uv >= 8) return 'very-high';
  if (uv >= 6) return 'high';
  if (uv >= 3) return 'moderate';
  return 'low';
};

export const useAirQualityCategory = (aqi) => {
  if (aqi >= 300) return 'hazardous';
  if (aqi >= 250) return 'very-unhealthy';
  if (aqi >= 200) return 'unhealthy';
  if (aqi >= 150) return 'unhealthy-for-sensitive';
  if (aqi >= 100) return 'moderate';
  if (aqi >= 50) return 'good-for-sensitive';
  return 'good';
};

export const useLocationSearch = () => {
  const queryClient = useQueryClient();
  const { setLocation } = useWeatherStore();

  const fetchLocation = async (query) => {
    const result = await withFallback(
      () => `${GEO}/direct?q=${encodeURIComponent(query)}&limit=1&appid=${API_KEY}`,
      () => openMeteoGeocode(query)
    )();
    return result[0];
  };

  return useMutation({
    mutationFn: fetchLocation,
    onSuccess: (data) => {
      if (data?.name) {
        setLocation({
          name: data.name,
          lat: data.lat,
          lon: data.lon,
          country: data.country || '',
        });
        queryClient.invalidateQueries(['weather']);
        queryClient.invalidateQueries(['forecast']);
      }
    },
  });
};

export const useWeatherIntensification = () => {
  const { weather, oneCall } = useWeatherStore();
  const queryClient = useQueryClient();
  const insights = [];

  if (!weather || !oneCall) return insights;

  const alerts = oneCall.alerts || [];

  if (alerts.length > 0) {
    alerts.forEach(alert => {
      insights.push({
        type: 'severe-weather',
        event: alert.event,
        severity: alert.severity || 'warning',
        message: alert.description,
        timestamp: new Date(alert.start * 1000).getTime(),
      });
    });
  }

  const tempToday = weather.main?.temp || 0;
  const tempTomorrow = oneCall.daily?.[1]?.temp?.day ?? tempToday;
  const tempChange = tempTomorrow - tempToday;

  if (Math.abs(tempChange) > 10) {
    insights.push({
      type: 'temperature',
      change: Math.round(tempChange),
      message: tempChange > 0 ? 'Rapid warming trend' : 'Cooling trend approaching',
      recommendation: tempChange > 0
        ? 'Stay hydrated and wear light clothing'
        : 'Layer up with warm clothing',
      icon: tempChange > 0 ? '🔥' : '❄️'
    });
  }

  const windSpeed = oneCall.current?.wind_speed || 0;

  if (windSpeed > 10) {
    insights.push({
      type: 'wind',
      severity: 'warning',
      message: 'Strong winds detected',
      recommendation: 'Secure loose outdoor objects',
      icon: '💨'
    });
  }

  queryClient.setQueryData(['weatherIntel'], insights);

  return insights;
};

export const useWeatherAdaptations = () => {
  const insights = useWeatherIntensification();
  const { setError } = useWeatherStore();

  useEffect(() => {
    if (!insights || insights.length === 0) return;

    insights.forEach(insight => {
      if (insight.severity === 'hazardous' || insight.severity === 'warning') {
        setError(`${insight.event || insight.message} — ${insight.recommendation || ''}`);
      }
    });
  }, [insights, setError]);
};
