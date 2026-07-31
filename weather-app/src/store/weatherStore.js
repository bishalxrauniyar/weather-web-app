import { create } from 'zustand';

const getWeatherType = (code) => {
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

const getWeatherSeverity = (code) => {
  if (code >= 200 && code < 300) return 'extreme';
  if (code >= 600 && code < 700) return 'high';
  if (code >= 700 && code < 800) return 'moderate';
  if (code >= 803) return 'low';
  return 'normal';
};

/* Solar day/night from pure astronomy — no API needed. Used as an immediate
   fallback whenever the location changes, so day/night stays correct even if
   the weather fetch for the new place is slow or rate-limited (setWeather
   overwrites it with the API's sunrise/sunset when that arrives). */
const sunDaytime = (lat, lon) => {
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  const decl = (23.44 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81)) * Math.PI) / 180;
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
  const hourAngle = ((utcHours + lon / 15 - 12) * 15 * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const alt = Math.asin(
    Math.sin(latRad) * Math.sin(decl) + Math.cos(latRad) * Math.cos(decl) * Math.cos(hourAngle)
  );
  return alt > -0.012; /* sun above ~-0.7° — matches the sunrise/sunset definition */
};

export const useWeatherStore = create((set, get) => ({
  weather: null,
  forecast: null,
  oneCall: null,
  dailyForecast: null,
  historicalWeather: null,
  airQuality: null,
  uvIndex: null,
  weatherAlerts: null,
  weatherType: 'clear',
  weatherSeverity: 'normal',
  isDaytime: true,
  interacted: false,
  location: { name: 'London', lat: 51.5074, lon: -0.1278, country: '', state: '' },
  currentLocation: 'London',
  searchResults: [],
  recentSearches: JSON.parse(localStorage.getItem('recentSearches') || '[]'),
  favorites: JSON.parse(localStorage.getItem('favoriteCities') || '[]'),
  isLoading: false,
  isLoadingMore: false,
  error: null,
  soundEnabled: false,
  particleDensity: 1,
  theme: 'light',
  units: 'metric',
  aiInsights: [],
  weatherHistory: [],
  weatherPreferences: {
    showUV: true,
    showAQI: true,
    showAlerts: true,
    autoLocation: true,
  },
  weatherLayers: {
    clouds: true,
    precipitation: true,
    wind: false,
    temperature: false,
    pressure: false,
  },
  travelMode: false,
  travelDestinations: [],
  earthTheme: 'satellite',
  communityReports: [],
  smartHomeSettings: {
    autoAdjust: false,
    thermostatOffset: 0,
    windowControl: false,
  },

  setWeather: (data) => {
    if (!data || !data.weather || !data.weather[0]) return;
    
    const weatherType = getWeatherType(data.weather[0].id);
    const weatherSeverity = getWeatherSeverity(data.weather[0].id);
    const sunset = data.sys?.sunset * 1000;
    const sunrise = data.sys?.sunrise * 1000;
    const now = Date.now();
    const isDaytime = sunset && sunrise && now > sunrise && now < sunset;

    set({
      weather: data,
      weatherType,
      weatherSeverity,
      isDaytime,
    });
  },

  setOneCall: (data) => {
    if (!data) return;
    set({
      oneCall: data,
      uvIndex: data.uvi?.[0]?.value || 0,
      weatherAlerts: data.alerts || [],
    });
  },

  setDailyForecast: (data) => set({ dailyForecast: data }),

  setAirQuality: (data) => set({ airQuality: data }),

  setHistoricalWeather: (data) => set({ historicalWeather: data }),

  setForecast: (data) => set({ forecast: data }),

  setLocation: (location) => {
    const recent = get().recentSearches;
    const updated = [location.name, ...recent.filter((n) => n !== location.name)].slice(0, 10);
    const prev = get().location;
    const moved = prev.lat !== location.lat || prev.lon !== location.lon;
    localStorage.setItem('recentSearches', JSON.stringify(updated));
    set({
      location,
      recentSearches: updated,
      currentLocation: location.name,
      isDaytime: sunDaytime(location.lat, location.lon),
      interacted: moved ? true : get().interacted,
    });
  },

  setTravelDestinations: (destinations) => {
    set({ travelDestinations: destinations });
  },

  addTravelDestination: (destination) => {
    const destinations = get().travelDestinations;
    if (!destinations.find(d => d.lat === destination.lat && d.lon === destination.lon)) {
      set({ travelDestinations: [...destinations, destination] });
    }
  },

  removeTravelDestination: (index) => {
    const destinations = get().travelDestinations;
    const updated = destinations.filter((_, i) => i !== index);
    set({ travelDestinations: updated });
  },

  toggleFavorite: (city) => {
    const favorites = get().favorites;
    const idx = favorites.indexOf(city);
    const updated = idx >= 0 ? favorites.filter((c) => c !== city) : [...favorites, city];
    localStorage.setItem('favoriteCities', JSON.stringify(updated));
    set({ favorites: updated });
  },

  setSearchResults: (results) => set({ searchResults: results }),

  setLoading: (isLoading) => set({ isLoading }),

  setLoadingMore: (isLoadingMore) => set({ isLoadingMore }),

  setError: (error) => set({ error }),

  clearError: () => set({ error: null }),

  toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),

  setParticleDensity: (density) => set({ particleDensity: density }),

  setTheme: (theme) => set({ theme }),

  setUnits: (units) => set({ units }),

  setWeatherPreferences: (prefs) => set((s) => ({ weatherPreferences: { ...s.weatherPreferences, ...prefs } })),

  setWeatherLayers: (layers) => set((s) => ({ weatherLayers: { ...s.weatherLayers, ...layers } })),

  toggleWeatherLayer: (layer) => set((s) => ({
    weatherLayers: { ...s.weatherLayers, [layer]: !s.weatherLayers[layer] }
  })),

  setTravelMode: (enabled) => set({ travelMode: enabled }),

  setEarthTheme: (theme) => set({ earthTheme: theme }),

  setAIInsights: (insights) => set({ aiInsights: insights }),

  setCommunityReports: (reports) => set({ communityReports: reports }),

  addCommunityReport: (report) => set((s) => ({
    communityReports: [...s.communityReports, report]
  })),

  setSmartHomeSettings: (settings) => set((s) => ({
    smartHomeSettings: { ...s.smartHomeSettings, ...settings }
  })),

  addToWeatherHistory: (entry) => set((s) => ({
    weatherHistory: [entry, ...s.weatherHistory.slice(0, 99)]
  })),

  clearWeatherHistory: () => set({ weatherHistory: [] }),

  exportWeatherData: () => {
    const history = get().weatherHistory;
    const dataStr = JSON.stringify(history, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'weather-history.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  },
}));

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