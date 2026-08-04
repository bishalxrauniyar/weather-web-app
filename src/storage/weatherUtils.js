export const getWeatherType = (code) => {
  if (code >= 200 && code < 300) return 'thunderstorm';
  if (code >= 300 && code < 400) return 'drizzle';
  if (code >= 500 && code < 600) return 'rain';
  if (code >= 600 && code < 700) return 'snow';
  if (code >= 700 && code < 800) return 'mist';
  if (code === 800) return 'clear';
  if (code === 801 || code === 802) return 'partly-cloudy';
  if (code >= 803) return 'cloudy';
  return 'clear';
};

export const getWeatherSeverity = (code) => {
  if (code >= 200 && code < 300) return 'extreme';
  if (code >= 600 && code < 700) return 'high';
  if (code >= 700 && code < 800) return 'moderate';
  if (code >= 803) return 'low';
  return 'normal';
};

export const getUVLevel = (uvIndex) => {
  if (uvIndex >= 11) return { level: 'extreme', color: '#ff0000' };
  if (uvIndex >= 8) return { level: 'very-high', color: '#ff7300' };
  if (uvIndex >= 6) return { level: 'high', color: '#ffea00' };
  if (uvIndex >= 3) return { level: 'moderate', color: '#88e600' };
  return { level: 'low', color: '#88e600' };
};

export const getAqiLevel = (aqi) => {
  if (aqi >= 300) return { level: 'hazardous', color: '#880000' };
  if (aqi >= 250) return { level: 'very-unhealthy', color: '#9b2d2d' };
  if (aqi >= 200) return { level: 'unhealthy', color: '#ff0000' };
  if (aqi >= 150) return { level: 'unhealthy-for-sensitive', color: '#ff7300' };
  if (aqi >= 100) return { level: 'moderate', color: '#ffea00' };
  if (aqi >= 50) return { level: 'good-for-sensitive', color: '#88e600' };
  return { level: 'good', color: '#00e688' };
};

export const getWeatherColor = (weatherType) => {
  const colors = {
    clear: '#0a2a5a',
    'partly-cloudy': '#3a8ad0',
    cloudy: '#2a3a4a',
    rain: '#0a0a18',
    drizzle: '#1a1a2a',
    thunderstorm: '#05050a',
    snow: '#6a8aA0',
    mist: '#4a4a5a',
    fog: '#4a4a5a',
    wind: '#3a3a4a',
  };
  return colors[weatherType] || colors.clear;
};

export const getWeatherIcon = (weatherType) => {
  const icons = {
    clear: '☀',
    'partly-cloudy': '🌤',
    cloudy: '☁',
    rain: '🌧',
    drizzle: '🌦',
    thunderstorm: '⛈',
    snow: '❄',
    mist: '🌫',
    fog: '🌁',
    wind: '💨',
  };
  return icons[weatherType] || icons.clear;
};

export const formatTemperature = (temp, units = 'metric') => {
  if (units === 'imperial') {
    return `${Math.round(temp * 9/5 + 32)}°F`;
  }
  return `${Math.round(temp)}°C`;
};

export const formatWindSpeed = (speed, units = 'metric') => {
  if (units === 'imperial') {
    return `${Math.round(speed * 2.237)} mph`;
  }
  return `${Math.round(speed * 3.6)} km/h`;
};

export const formatPressure = (pressure) => {
  return `${pressure} hPa`;
};

export const formatHumidity = (humidity) => {
  return `${humidity}%`;
};

export const formatUVIndex = (uvIndex) => {
  if (uvIndex === undefined || uvIndex === null) return '--';
  return uvIndex.toFixed(1);
};

export const formatAQI = (aqi) => {
  if (aqi === undefined || aqi === null) return '--';
  return aqi;
};

export const getTimeOfDay = (sunrise, sunset, now = Date.now()) => {
  const sr = sunrise * 1000;
  const ss = sunset * 1000;
  if (now > sr && now < ss) return 'day';
  return 'night';
};

export const getWindDirection = (degrees) => {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
};

export const formatTimestamp = (timestamp, options = {}) => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', ...options });
};

export const formatDate = (timestamp, options = {}) => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', ...options });
};

export const kelvinToCelsius = (kelvin) => {
  return kelvin - 273.15;
};

export const celsiusToFahrenheit = (celsius) => {
  return celsius * 9/5 + 32;
};

export const mpsToKmh = (mps) => {
  return mps * 3.6;
};

export const mpsToMph = (mps) => {
  return mps * 2.237;
};

/* Magnus formula — real dew point in °C */
export const getDewPoint = (tempC, humidity) => {
  if (tempC == null || humidity == null) return null;
  const a = 17.625;
  const b = 243.04;
  const alpha = Math.log(humidity / 100) + (a * tempC) / (b + tempC);
  return (b * alpha) / (a - alpha);
};

/* Beaufort scale name from km/h */
export const getBeaufort = (kmh) => {
  if (kmh < 1) return 'Calm';
  if (kmh < 6) return 'Light air';
  if (kmh < 12) return 'Light breeze';
  if (kmh < 20) return 'Gentle breeze';
  if (kmh < 29) return 'Moderate breeze';
  if (kmh < 39) return 'Fresh breeze';
  if (kmh < 50) return 'Strong breeze';
  if (kmh < 62) return 'Near gale';
  if (kmh < 75) return 'Gale';
  if (kmh < 89) return 'Strong gale';
  if (kmh < 103) return 'Storm';
  return 'Violent storm';
};

/* Pressure trend from a forecast list (compare ~9h apart) */
export const getPressureTrend = (forecastList) => {
  if (!forecastList?.length) return { delta: 0, label: 'Steady' };
  const p0 = forecastList[0]?.main?.pressure;
  const ref = forecastList[Math.min(3, forecastList.length - 1)]?.main?.pressure;
  if (p0 == null || ref == null) return { delta: 0, label: 'Steady' };
  const delta = ref - p0;
  if (delta >= 2) return { delta, label: 'Rising' };
  if (delta <= -2) return { delta, label: 'Falling' };
  return { delta, label: 'Steady' };
};

export const getUVBurnTime = (uv) => {
  if (uv <= 2) return '60+ min';
  if (uv <= 5) return '~40 min';
  if (uv <= 7) return '~25 min';
  if (uv <= 10) return '~12 min';
  return '~6 min';
};

/* Unit helpers for the °C/°F toggle */
export const toUnit = (celsius, unit) =>
  unit === 'imperial' ? Math.round((celsius * 9) / 5 + 32) : Math.round(celsius);

export const unitSymbol = (unit) => (unit === 'imperial' ? '°F' : '°C');