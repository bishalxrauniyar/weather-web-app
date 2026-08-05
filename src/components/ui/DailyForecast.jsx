import { useMemo } from 'react';
import { motion } from 'framer-motion';
import Icon from './icons';
import { toUnit, unitSymbol } from '../../storage/weatherUtils';

/* Hourly rain per day from the forecast's per-hour feed (grouped by the same
   calendar day the rail rows use). Falls back to 3h-block spreading when no
   hourly feed exists. */
function hourlyByDay(forecast) {
  const list = forecast?.list || [];
  const hourly = forecast?._hourly;
  if (hourly?.length) return hourly;
  const out = [];
  list.forEach((i) => {
    const rain = i.rain?.['3h'] ?? i.rain?.['1h'] ?? 0;
    for (let k = 0; k < 3; k++) {
      out.push({ dt: i.dt + k * 3600, rain: rain / 3, pop: i.pop || 0 });
    }
  });
  return out;
}

/* Tiny per-hour rain bars for one day — height ∝ mm, tooltip = hour + mm. */
function RainBars({ hours }) {
  const max = Math.max(...hours.map((h) => h.rain), 0.01);
  return (
    <div className="rain-mini-bars" aria-hidden="true">
      {hours.map((h) => {
        const d = new Date(h.dt * 1000);
        const t = d.toLocaleTimeString('en-US', { hour: 'numeric' });
        const pct = Math.max(2, Math.round((h.rain / max) * 100));
        return (
          <div key={h.dt} className="rain-mini-bar" title={`${t} — ${h.rain.toFixed(1)} mm`}>
            <div className="rain-mini-fill" style={{ height: `${pct}%` }} />
          </div>
        );
      })}
    </div>
  );
}

export default function DailyForecast({ forecast, units = 'metric', onSelect }) {
  const days = useMemo(() => {
    if (!forecast?.list) return [];

    const groups = new Map();
    forecast.list.forEach((item) => {
      const key = new Date(item.dt * 1000).toDateString();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });

    /* Per-hour rain for each rail row — the same 10-day window as the rows. */
    const hourly = hourlyByDay(forecast);
    const rainByDay = new Map();
    hourly.forEach((h) => {
      const key = new Date(h.dt * 1000).toDateString();
      if (!rainByDay.has(key)) rainByDay.set(key, []);
      rainByDay.get(key).push(h);
    });

    return [...groups.values()].slice(0, 10).map((items, idx) => {
      const mid = items[Math.floor(items.length / 2)];
      const temps = items.map((i) => toUnit(i.main.temp, units));
      const pops = items.map((i) => i.pop || 0);
      const date = new Date(items[0].dt * 1000);
      const today = idx === 0;

      return {
        items,
        label: today ? 'Today' : date.toLocaleDateString([], { weekday: 'short' }),
        icon: mid.weather[0].icon,
        cond: mid.weather[0].description,
        pop: Math.round(Math.max(...pops) * 100),
        min: Math.round(Math.min(...temps)),
        max: Math.round(Math.max(...temps)),
        rainHours: rainByDay.get(date.toDateString()) || [],
      };
    });
  }, [forecast, units]);

  if (days.length === 0) return null;

  const allMin = Math.min(...days.map((d) => d.min));
  const allMax = Math.max(...days.map((d) => d.max));
  const range = allMax - allMin || 1;

  return (
    <div className="day-list">
      {days.map((day, i) => {
        const left = ((day.min - allMin) / range) * 100;
        const width = ((day.max - day.min) / range) * 100 + 4;

        return (
          <motion.div
            key={day.label + i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="day-row clickable"
            role="button"
            tabIndex={0}
            aria-label={`${day.label} — ${day.cond}, high ${day.max}${unitSymbol(units)}, low ${day.min}${unitSymbol(units)}. Open full-day details`}
            onClick={() => onSelect?.(day)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect?.(day);
              }
            }}
          >
            <span className={`day-label ${day.label === 'Today' ? 'today' : ''}`}>{day.label}</span>
            <Icon name={day.icon} size={20} className="text-white/80 justify-self-center" />
            <div className="min-w-0">
              <div className="day-cond mb-1.5">{day.cond}</div>
              <div className="temp-bar-track">
                <div
                  className="temp-bar-fill"
                  style={{ left: `${Math.min(left, 96)}%`, width: `${Math.min(width, 100 - Math.min(left, 96))}%` }}
                />
              </div>
              {/* Per-hour rain for the day — hover any bar for the exact hour */}
              {day.rainHours.length > 0 && <RainBars hours={day.rainHours} />}
            </div>
            <span className="day-pop">{day.pop > 0 ? `${day.pop}%` : ''}</span>
            <div className="day-temps">
              <span className="max">{day.max}{unitSymbol(units)}</span>
              <span className="min">{day.min}{unitSymbol(units)}</span>
            </div>
            <span className="day-chev text-white/50 flex items-center justify-center">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
