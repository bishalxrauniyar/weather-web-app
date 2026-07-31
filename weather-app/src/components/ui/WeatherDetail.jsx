import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { MetricIcon } from './icons';
import {
  getWindDirection,
  getDewPoint,
  getBeaufort,
  getPressureTrend,
  getUVBurnTime,
} from '../../storage/weatherUtils';
import { useWeatherStore } from '../../store/weatherStore';

function feelsLikeDelta(weather) {
  if (!weather?.main?.temp || !weather?.main?.feels_like) return 0;
  return Math.round(weather.main.feels_like - weather.main.temp);
}

function buildDetail(type, weather, forecastList, uvIndex) {
  const temp = weather?.main?.temp ?? 0;
  const feels = weather?.main?.feels_like ?? temp;
  const windKmh = Math.round((weather?.wind?.speed || 0) * 3.6);
  const gustKmh = weather?.wind?.gust ? Math.round(weather.wind.gust * 3.6) : null;
  const humidity = weather?.main?.humidity ?? 0;
  const dew = getDewPoint(weather?.main?.temp, weather?.main?.humidity);
  const pressure = weather?.main?.pressure ?? 0;
  const trend = getPressureTrend(forecastList);
  const visibilityKm = (weather?.visibility ?? 0) / 1000;
  const delta = feelsLikeDelta(weather);
  const uv = Math.round(uvIndex || Math.max(0, 11 - Math.round((weather?.clouds?.all || 0) / 10)));
  const uvLevel = uv <= 2 ? 'Low' : uv <= 5 ? 'Moderate' : uv <= 7 ? 'High' : uv <= 10 ? 'Very High' : 'Extreme';
  const cloudPct = weather?.clouds?.all ?? 0;

  switch (type) {
    case 'TEMPERATURE': {
      const advice =
        delta <= -4
          ? `Wind chill makes it feel ${Math.abs(delta)}° colder than the air — add a layer.`
          : delta >= 4
            ? `Humidity makes it feel ${delta}° warmer — it will be sticky out there.`
            : temp >= 27
              ? 'It is a warm one — light clothes, water, and shade where possible.'
              : temp <= 8
                ? 'Bundle up — exposed skin gets uncomfortable fast in this cold.'
                : 'Conditions are mild — a light layer is all you need.';
      return {
        headline: `${Math.round(temp)}° now, feels like ${Math.round(feels)}°`,
        icon: 'feelslike',
        stats: [
          { label: 'Current', value: `${Math.round(temp)}°` },
          { label: 'Feels like', value: `${Math.round(feels)}°` },
          { label: 'Today high', value: `${Math.round(weather?.main?.temp_max ?? temp)}°` },
          { label: 'Today low', value: `${Math.round(weather?.main?.temp_min ?? temp)}°` },
        ],
        advice,
      };
    }

    case 'WIND': {
      const chillNote =
        delta <= -4
          ? `Wind chill drags the perceived temperature to ${Math.round(feels)}°.`
          : gustKmh
            ? `Gusts of ${gustKmh} km/h can knock loose objects around.`
            : 'Steady breeze — no major gusts expected.';
      return {
        headline: `${getBeaufort(windKmh)} · ${windKmh} km/h`,
        icon: 'wind',
        stats: [
          { label: 'Speed', value: `${windKmh} km/h` },
          { label: 'Direction', value: weather?.wind?.deg != null ? getWindDirection(weather.wind.deg) : '—' },
          { label: 'Gusts', value: gustKmh ? `${gustKmh} km/h` : 'Calm' },
          { label: 'Chill effect', value: `${Math.round(feels)}°` },
        ],
        advice: windKmh >= 40
          ? 'Strong winds — secure loose outdoor items and expect bumpy conditions.'
          : chillNote,
      };
    }

    case 'HUMIDITY': {
      const comfort =
        humidity < 25 ? 'Dry air' : humidity < 50 ? 'Comfortable' : humidity < 70 ? 'Mildly humid' : 'Humid';
      const dewNote =
        dew != null
          ? dew >= 18
            ? `Dew point of ${Math.round(dew)}° means muggy, sticky air — sweat won't evaporate well.`
            : dew <= 5
              ? `Dew point of ${Math.round(dew)}° — crisp, dry air.`
              : `Dew point of ${Math.round(dew)}° — the air feels fine.`
          : '';
      return {
        headline: `${humidity}% · ${comfort}`,
        icon: 'drop',
        stats: [
          { label: 'Humidity', value: `${humidity}%`, pct: Math.min(humidity / 100, 1) },
          { label: 'Dew point', value: dew != null ? `${Math.round(dew)}°` : '—' },
          { label: 'Feels like', value: `${Math.round(feels)}°` },
          { label: 'Comfort', value: comfort },
        ],
        advice: humidity >= 75 && temp >= 24
          ? 'High humidity + heat = your body cools less efficiently. Stay in shade and hydrate.'
          : humidity < 25
            ? 'Very dry air — moisturise and drink more water than usual.'
            : dewNote,
      };
    }

    case 'UV INDEX': {
      const protection = uv > 5 ? 'SPF 30+ needed' : uv > 2 ? 'SPF 15 recommended' : 'No protection needed';
      return {
        headline: `UV ${uv} · ${uvLevel}`,
        icon: 'uv',
        stats: [
          { label: 'Index', value: uv, pct: Math.min(uv / 11, 1), barColor: uv > 7 ? '#ff5e5e' : uv > 5 ? '#ffb25e' : '#ffd25e' },
          { label: 'Risk level', value: uvLevel },
          { label: 'Unprotected burn', value: getUVBurnTime(uv) },
          { label: 'Protection', value: protection },
        ],
        advice: uv >= 6
          ? 'Peak sun danger hours are 10am–4pm. Cover up, seek shade, and reapply sunscreen.'
          : uv > 2
            ? 'Sunlight is noticeable — a hat or light SPF is sensible for long stretches outside.'
            : 'Sun strength is low — normal outdoor activity is fine.',
      };
    }

    case 'PRESSURE': {
      const story =
        trend.label === 'Rising'
          ? 'Pressure is climbing — expect skies to clear and winds to settle.'
          : trend.label === 'Falling'
            ? 'Pressure is dropping — unsettled weather, clouds or showers are moving in.'
            : pressure >= 1022
              ? 'High pressure — settled, stable weather.'
              : pressure <= 1000
                ? 'Low pressure — the atmosphere is restless.'
                : 'Normal pressure — nothing dramatic brewing.';
      return {
        headline: `${pressure} hPa · ${trend.label.toLowerCase()}`,
        icon: 'gauge',
        stats: [
          { label: 'Current', value: `${pressure} hPa` },
          { label: 'Trend', value: trend.label },
          { label: 'Δ 9h', value: `${trend.delta >= 0 ? '+' : ''}${trend.delta.toFixed(1)} hPa` },
          { label: 'Cloud cover', value: `${cloudPct}%`, pct: Math.min(cloudPct / 100, 1) },
        ],
        advice: story,
      };
    }

    case 'VISIBILITY': {
      const cond = visibilityKm >= 10 ? 'Clear' : visibilityKm >= 5 ? 'Moderate' : visibilityKm >= 2 ? 'Hazy' : 'Poor';
      return {
        headline: `${visibilityKm.toFixed(1)} km · ${cond}`,
        icon: 'eye',
        stats: [
          { label: 'Distance', value: `${visibilityKm.toFixed(1)} km`, pct: Math.min(visibilityKm / 10, 1) },
          { label: 'Condition', value: cond },
          { label: 'Driving', value: visibilityKm >= 10 ? 'Full visibility' : visibilityKm >= 5 ? 'Easy going' : 'Take it slow' },
          { label: 'Fog risk', value: visibilityKm < 2 ? 'High' : visibilityKm < 5 ? 'Possible' : 'Low' },
        ],
        advice: visibilityKm < 2
          ? 'Thick haze/fog — use low beams, slow down, and leave extra following distance.'
          : visibilityKm < 5
            ? 'Reduced visibility — headlights on and extra care at junctions.'
            : 'Clear sight lines — no visibility concerns.',
      };
    }

    default:
      return null;
  }
}

function buildSparkline(forecastList) {
  if (!forecastList?.length) return null;
  return forecastList.slice(0, 24).map((h) => h?.main?.temp).filter((t) => t != null);
}

function Sparkline({ temps }) {
  if (!temps || temps.length < 2) return null;
  const w = 300;
  const h = 64;
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const range = Math.max(1, max - min);
  const pts = temps.map((t, i) => {
    const x = (i / (temps.length - 1)) * w;
    const y = h - 6 - ((t - min) / range) * (h - 14);
    return [x, y];
  });
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `0,${h} ${line} ${w},${h}`;

  return (
    <div className="relative mt-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-white/40">
          Next 24 hours
        </span>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-[#5ee0ff]">{Math.round(max)}° high</span>
          <span className="text-white/40">{Math.round(min)}° low</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16" preserveAspectRatio="none">
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="spark-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="#5ee0ff" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#spark-fill)" />
        <polyline
          points={line}
          fill="none"
          stroke="url(#spark-line)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={pts[pts.length - 1][0]}
          cy={pts[pts.length - 1][1]}
          r="3.5"
          fill="#5ee0ff"
        />
      </svg>
    </div>
  );
}

export default function WeatherDetail({ isOpen, onClose, type, weather, forecast }) {
  const uvIndex = useWeatherStore((s) => s.uvIndex);
  const location = useWeatherStore((s) => s.location);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const data = type ? buildDetail(type, weather, forecast?.list, uvIndex) : null;

  return (
    <AnimatePresence>
      {isOpen && data && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none"
          >
            <div className="detail-panel pointer-events-auto w-full max-w-xl">
              {/* Accent edge */}
              <div
                className="h-[3px]"
                style={{
                  background: `linear-gradient(90deg, var(--accent), transparent 70%)`,
                }}
              />

              {/* Header */}
              <div className="relative overflow-hidden px-8 pt-8 pb-7">
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `radial-gradient(120% 140% at 0% 0%, var(--accent-soft), transparent 55%)`,
                  }}
                />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4.5">
                    <motion.span
                      animate={{ y: [0, -3, 0], rotate: [0, -3, 0] }}
                      transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                      className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{
                        background: 'linear-gradient(145deg, var(--accent-soft), rgba(255,255,255,0.04))',
                        border: '1px solid var(--line-strong)',
                        color: 'var(--accent)',
                        boxShadow: '0 8px 24px -8px var(--accent-soft)',
                      }}
                    >
                      <MetricIcon name={data.icon} size={26} />
                    </motion.span>
                    <div>
                      <h2 className="text-[26px] font-semibold leading-tight tracking-tight">
                        {data.headline}
                      </h2>
                      <span
                        className="inline-flex mt-2 items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full"
                        style={{
                          color: 'var(--accent)',
                          background: 'var(--accent-soft)',
                          border: '1px solid var(--line)',
                        }}
                      >
                        <MetricIcon name={data.icon} size={11} />
                        {type.replace(/_/g, ' ').toLowerCase()}
                      </span>
                      <span className="block mt-2 text-xs text-white/45">
                        {location?.name}
                        {weather?.weather?.[0]?.description
                          ? ` · ${weather.weather[0].description}`
                          : ''}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    aria-label="Close"
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/12 hover:rotate-90 transition-all duration-200 text-white/60 hover:text-white shrink-0 border border-white/10"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Stats grid */}
              <div className="px-8 grid grid-cols-2 gap-4">
                {data.stats.map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 + i * 0.055, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ y: -2 }}
                    className="relative overflow-hidden rounded-2xl px-5 py-4 border transition-colors duration-200 group"
                    style={{
                      background: 'var(--panel-soft)',
                      borderColor: 'var(--line)',
                    }}
                  >
                    <span className="absolute left-0 top-0 bottom-0 w-[3px] opacity-50 group-hover:opacity-100 transition-opacity duration-200"
                      style={{ background: 'var(--accent)' }} />
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <span className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/50 group-hover:text-accent transition-colors duration-200">
                        <MetricIcon name={data.icon} size={15} />
                      </span>
                      <span className="label-text">{stat.label}</span>
                    </div>
                    <p className="value-text text-[22px] font-[var(--font-display)] font-bold leading-tight tracking-tight">
                      {stat.value}
                    </p>
                    {stat.pct != null && (
                      <div className="mt-2.5 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.round(stat.pct * 100)}%` }}
                          transition={{ delay: 0.18 + i * 0.055, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full rounded-full"
                          style={{
                            background:
                              stat.barColor ||
                              'linear-gradient(90deg, var(--accent), #5ee0ff)',
                          }}
                        />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {type === 'TEMPERATURE' && (
                <div className="px-8">
                  <Sparkline temps={buildSparkline(forecast?.list)} />
                </div>
              )}

              {/* Practical advice */}
              <div className="px-8 pt-4 pb-8">
                <div
                  className="rounded-2xl p-5"
                  style={{
                    background: `linear-gradient(135deg, var(--accent-soft), transparent 60%)`,
                    border: '1px solid var(--line-strong)',
                    borderLeft: '3px solid var(--accent)',
                  }}
                >
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.13em] mb-2"
                    style={{ color: 'var(--accent)' }}
                  >
                    What it means for you
                  </p>
                  <p className="text-sm text-white/75 leading-relaxed">{data.advice}</p>
                </div>
                <div className="flex items-center justify-between mt-5">
                  <p className="text-xs text-white/30">Press ESC or click outside to close</p>
                  <button
                    onClick={onClose}
                    className="text-xs font-semibold px-4 py-2 rounded-full transition-colors"
                    style={{
                      color: 'var(--accent)',
                      background: 'var(--accent-soft)',
                      border: '1px solid var(--line)',
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}