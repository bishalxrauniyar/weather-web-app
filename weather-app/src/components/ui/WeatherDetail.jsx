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
          { label: 'Humidity', value: `${humidity}%` },
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
          { label: 'Index', value: uv },
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
          { label: 'Cloud cover', value: `${cloudPct}%` },
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
          { label: 'Distance', value: `${visibilityKm.toFixed(1)} km` },
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

export default function WeatherDetail({ isOpen, onClose, type, weather, forecast }) {
  const uvIndex = useWeatherStore((s) => s.uvIndex);

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
            <div className="detail-panel pointer-events-auto w-full max-w-lg">
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
                    <span
                      className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{
                        background: 'linear-gradient(145deg, var(--accent-soft), rgba(255,255,255,0.04))',
                        border: '1px solid var(--line-strong)',
                        color: 'var(--accent)',
                        boxShadow: '0 8px 24px -8px var(--accent-soft)',
                      }}
                    >
                      <MetricIcon name={data.icon} size={26} />
                    </span>
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
              <div className="px-8 grid grid-cols-2 gap-3.5">
                {data.stats.map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 + i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="relative overflow-hidden rounded-2xl px-5 py-4 border"
                    style={{
                      background: 'var(--panel-soft)',
                      borderColor: 'var(--line)',
                    }}
                  >
                    <span
                      className="absolute left-0 top-0 bottom-0 w-[2.5px] opacity-60"
                      style={{ background: 'var(--accent)' }}
                    />
                    <p className="label-text mb-1.5">{stat.label}</p>
                    <p className="value-text text-[22px] font-[var(--font-display)] font-semibold leading-tight">
                      {stat.value}
                    </p>
                  </motion.div>
                ))}
              </div>

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
                <p className="text-center text-xs text-white/30 mt-5">
                  Press ESC or click outside to close
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}