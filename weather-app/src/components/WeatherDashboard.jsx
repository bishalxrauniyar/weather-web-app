import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import {
  useCurrentWeather,
  useForecast,
  useAlerts,
  useAQI,
  useGeolocation,
} from '../hooks/useWeather';
import { useWeatherStore } from '../store/weatherStore';
import { toUnit, unitSymbol } from '../storage/weatherUtils';
import SearchBar from './ui/SearchBar';
import HourlyStrip from './ui/HourlyStrip';
import DailyForecast from './ui/DailyForecast';
import MetricGrid from './ui/MetricGrid';
import WeatherBrief from './ui/WeatherBrief';
import WeatherDetail from './ui/WeatherDetail';
import TravelBoard from './ui/TravelBoard';
import EarthThemePicker from './ui/EarthThemePicker';
import Icon from './ui/icons';

function AnimatedTemp({ temp, unit }) {
  const [animTemp, setAnimTemp] = useState(0);
  const state = useRef({ val: 0 }).current;
  const target = toUnit(temp, unit);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tween = gsap.to(state, {
      val: target,
      duration: reduce ? 0.001 : 1.4,
      ease: 'power3.out',
      onUpdate: () => setAnimTemp(Math.round(state.val)),
    });
    return () => tween.kill();
  }, [target, state]);

  return (
    <>
      {animTemp}
      {unitSymbol(unit)}
    </>
  );
}

const AQI_LABELS = {
  1: { label: 'Good', color: '#4ade80' },
  2: { label: 'Fair', color: '#a3e635' },
  3: { label: 'Moderate', color: '#facc15' },
  4: { label: 'Poor', color: '#fb923c' },
  5: { label: 'Very poor', color: '#f87171' },
};

/* Live local clock for the current location (12-hour format, AM/PM).
   `tzSec` is the location's UTC offset in seconds (OpenWeather `timezone`). */
function useLocalTime(tzSec) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (tzSec == null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [tzSec]);

  if (tzSec == null) return null;
  const utcMs = now + new Date().getTimezoneOffset() * 60000;
  return new Date(utcMs + tzSec * 1000).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function LocalTimeChip({ tzSec }) {
  const time = useLocalTime(tzSec);
  if (!time) return null;
  return (
    <span
      className="ml-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium text-white/70"
      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.16)' }}
      title="Local time"
    >
      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {time}
    </span>
  );
}

export default function WeatherDashboard() {
  const {
    setWeather,
    setForecast,
    setAirQuality,
    setLoading,
    setError,
    clearError,
    weather,
    weatherType,
    location,
    units,
    setUnits,
    error,
  } = useWeatherStore();
  const {
    data: weatherData,
    isLoading: weatherLoading,
    error: weatherError,
    refetch: refetchWeather,
  } = useCurrentWeather();
  const { data: forecastData, isLoading: forecastLoading } = useForecast();
  const { data: alertData } = useAlerts();
  const { data: aqi } = useAQI();
  const { refetch: refetchGeo } = useGeolocation();
  const [detailType, setDetailType] = useState(null);
  const [alertDismissed, setAlertDismissed] = useState(false);

  useEffect(() => {
    if (weatherData) {
      setWeather(weatherData);
      setLoading(false);
    }
    if (weatherError) {
      setError(weatherError.message);
      setLoading(false);
    }
    if (weatherLoading || forecastLoading) {
      setLoading(true);
    }
  }, [weatherData, weatherError, weatherLoading, forecastLoading, setWeather, setLoading, setError]);

  useEffect(() => {
    if (forecastData) setForecast(forecastData);
  }, [forecastData, setForecast]);

  useEffect(() => {
    if (aqi) setAirQuality(aqi);
  }, [aqi, setAirQuality]);

  const temp = weather?.main?.temp != null ? weather.main.temp : null;
  const feels = weather?.main?.feels_like != null ? weather.main.feels_like : null;
  const cond = weather?.weather?.[0]?.description || '—';
  const iconCode = weather?.weather?.[0]?.icon || '01d';
  const alerts = (alertData || weather?.alerts || []).filter(() => !alertDismissed);
  const aqiValue = aqi?.list?.[0]?.main?.aqi;
  const dataSource = weather?._source || forecastData?._source || aqi?._source;

  return (
    <div className={`app-shell wx-${weatherType || 'clear'}`}>
      {/* Top Bar */}
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Icon name={iconCode} size={18} />
          </div>
          <div className="brand-copy">
            <div className="brand-name">WeatherVerse</div>
            <div className="brand-sub">Living Weather</div>
          </div>
        </div>

        <div className="search-wrap">
          <SearchBar />
        </div>

          <div className="top-actions flex items-center gap-1.5">
              <button
                className="icon-btn"
                aria-label="Use my location"
                title="Use my location"
                onClick={() => refetchGeo()}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21s-6-5.2-6-10a6 6 0 1112 0c0 4.8-6 10-6 10z" />
                  <circle cx="12" cy="11" r="2.2" />
                </svg>
              </button>
              <button
                className="icon-btn"
                aria-label="Refresh"
                onClick={() => refetchWeather()}
                title="Refresh"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <EarthThemePicker />
              <div
                className="flex items-center rounded-full border border-white/10 p-0.5 text-[11px] tabular-nums"
                role="group"
                aria-label="Temperature units"
              >
                {['metric', 'imperial'].map((u) => (
                  <button
                    key={u}
                    onClick={() => setUnits(u)}
                    className={`px-3 py-1 rounded-full transition-all duration-200 ${
                      units === u
                        ? 'bg-white/15 text-white shadow-sm'
                        : 'text-white/30 hover:text-white/60'
                    }`}
                  >
                    {u === 'metric' ? '°C' : '°F'}
                  </button>
                ))}
              </div>
            </div>
      </header>

      {/* Content Rail */}
      <div className="content-rail">
        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-3 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl"
              style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)' }}
            >
              <span className="text-xs text-red-200/90 min-w-0 truncate">
                Couldn't load weather — {String(error).replace(/^Error: /, '')}
              </span>
              <button
                onClick={() => {
                  clearError();
                  refetchWeather();
                }}
                className="shrink-0 text-[11px] px-3 py-1.5 rounded-full bg-red-400/20 text-red-100 hover:bg-red-400/35 transition-colors"
              >
                Retry
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Weather alerts */}
        <AnimatePresence>
          {alerts.map((a) => (
            <motion.div
              key={a.event + (a.start || '')}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-3 px-4 py-3 rounded-2xl"
              style={{
                background: 'rgba(251,191,36,0.1)',
                border: '1px solid rgba(251,191,36,0.35)',
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse" />
                  <span className="text-xs font-semibold text-amber-100 truncate">{a.event}</span>
                </div>
                <button
                  onClick={() => setAlertDismissed(true)}
                  aria-label="Dismiss alert"
                  className="text-amber-200/40 hover:text-amber-100 transition-colors shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-[11px] text-amber-100/70 mt-1.5 leading-relaxed line-clamp-2">
                {a.description}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Location hero */}
        <section>
          <div className="loc-name">
            <span className="pin" />
            {location.name || 'Search for a city'}
            <LocalTimeChip tzSec={weather?.timezone} />
            {dataSource === 'open-meteo' && (
              <span
                className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-emerald-300/90"
                style={{
                  background: 'rgba(52,211,153,0.12)',
                  border: '1px solid rgba(52,211,153,0.35)',
                }}
                title="Free Open-Meteo data (no API key required)"
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Open-Meteo
              </span>
            )}
            {aqiValue && AQI_LABELS[aqiValue] && (
              <span
                className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{
                  color: AQI_LABELS[aqiValue].color,
                  background: `${AQI_LABELS[aqiValue].color}1a`,
                  border: `1px solid ${AQI_LABELS[aqiValue].color}40`,
                }}
                title="Air quality index (PM2.5)"
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v3m0 12v3m9-9h-3M6 12H3m13.5-4.5l2-2M5.5 18.5l2-2m0-9l-2-2m13.5 13.5l-2-2M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                AQI {AQI_LABELS[aqiValue].label}
              </span>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className={`temp-hero ${weatherLoading && !weather ? 'animate-pulse' : ''}`}
            onClick={() => setDetailType('TEMPERATURE')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setDetailType('TEMPERATURE')}
            aria-label="Tap for temperature details"
          >
            {temp != null ? <AnimatedTemp temp={temp} unit={units} /> : '--°'}
          </motion.div>

          <div className="condition-row">
            <span className="cond">{cond}</span>
            <span className="sep-dot">·</span>
            <span className="hilo">
              H:
              <strong>
                {weather?.main?.temp_max != null
                  ? `${toUnit(weather.main.temp_max, units)}${unitSymbol(units)}`
                  : '--'}
              </strong>
              {' '}L:
              <strong>
                {weather?.main?.temp_min != null
                  ? `${toUnit(weather.main.temp_min, units)}${unitSymbol(units)}`
                  : '--'}
              </strong>
              {feels != null && toUnit(feels, units) !== toUnit(temp, units) && (
                <span> · Feels {toUnit(feels, units)}{unitSymbol(units)}</span>
              )}
            </span>
          </div>
        </section>

        <WeatherBrief weather={weather} forecast={forecastData} units={units} />

        {/* Hourly strip */}
        <section>
          <div className="section-label">Hourly forecast</div>
          <HourlyStrip forecast={forecastData} units={units} />
        </section>

        <MetricGrid weather={weather} onSelect={setDetailType} units={units} />

        {/* Daily forecast */}
        <section>
          <div className="section-label">10-day forecast</div>
          <DailyForecast forecast={forecastData} units={units} />
        </section>

        <TravelBoard />

        <p className="text-[11px] text-white/25 text-center leading-relaxed pb-2">
          Drag to spin · scroll to zoom · search or click a country to fly there
        </p>
      </div>

      {/* Detail Modal */}
      <WeatherDetail
        isOpen={!!detailType}
        onClose={() => setDetailType(null)}
        type={detailType}
        weather={weather}
        forecast={forecastData}
      />
    </div>
  );
}
