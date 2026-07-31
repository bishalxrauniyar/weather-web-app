import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useWeatherStore } from '../../store/weatherStore';

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const iconMap = {
  '01d': '\u2600\uFE0F', '01n': '\uD83C\uDF19',
  '02d': '\u26C5', '02n': '\u26C5',
  '03d': '\u2601\uFE0F', '03n': '\u2601\uFE0F',
  '04d': '\u2601\uFE0F', '04n': '\u2601\uFE0F',
  '09d': '\uD83C\uDF27\uFE0F', '09n': '\uD83C\uDF27\uFE0F',
  '10d': '\uD83C\uDF27\uFE0F', '10n': '\uD83C\uDF27\uFE0F',
  '11d': '\u26C8\uFE0F', '11n': '\u26C8\uFE0F',
  '13d': '\u2744\uFE0F', '13n': '\u2744\uFE0F',
  '50d': '\uD83C\uDF2B\uFE0F', '50n': '\uD83C\uDF2B\uFE0F',
};

function TempRange({ high, low }) {
  const buffer = 4;
  const minRef = Math.min(low - buffer, -5);
  const maxRef = Math.max(high + buffer, 35);
  const range = maxRef - minRef;
  const left = ((low - buffer) - minRef) / range * 100;
  const width = (high - low + buffer * 2) / range * 100;

  return (
    <div className="relative w-20 h-1.5 rounded-full bg-white/8 overflow-hidden">
      <motion.div
        className="absolute h-full rounded-full bg-gradient-to-r from-blue-400 to-orange-400"
        style={{ left: `${left}%`, width: `${width}%` }}
        initial={{ scaleX: 0, transformOrigin: 'left' }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  );
}

export default function ForecastCard() {
  const { forecast } = useWeatherStore();

  const daily = useMemo(() => {
    if (!forecast) return [];
    const items = forecast.list.filter((item) => item.dt_txt.includes('12:00:00')).slice(0, 7);
    if (items.length === 0) {
      const seen = new Set();
      for (const item of forecast.list) {
        const date = item.dt_txt.split(' ')[0];
        if (!seen.has(date)) {
          seen.add(date);
          items.push(item);
        }
      }
    }
    return items.slice(0, 7);
  }, [forecast]);

  if (!forecast || daily.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className="glass-panel p-5 w-full max-w-md"
    >
      <h3 className="text-white/50 text-xs uppercase tracking-widest mb-4 font-medium">
        7-Day Forecast
      </h3>
      <div className="space-y-1">
        {daily.map((item, i) => {
          const date = new Date(item.dt * 1000);
          const dayName = i === 0 ? 'Today' : dayNames[date.getDay()];
          const iconCode = item.weather[0].icon;
          const high = Math.round(item.main.temp_max);
          const low = Math.round(item.main.temp_min);
          const pop = item.pop;
          const wind = item.wind?.speed;
          const desc = item.weather[0].description;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.04 * i }}
              className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0 group hover:bg-white/[0.02] rounded-lg transition-colors px-2 -mx-2"
            >
              {/* Day */}
              <span className="text-white/70 text-sm w-14 font-medium">{dayName}</span>

              {/* Icon + description */}
              <div className="flex items-center gap-1.5 w-24">
                <span className="text-lg">{iconMap[iconCode] || '\u2600\uFE0F'}</span>
                <span className="text-[10px] text-white/40 capitalize truncate hidden sm:inline">
                  {desc}
                </span>
              </div>

              {/* Low temp */}
              <span className="text-white/40 text-sm w-8 text-right">{low}°</span>

              {/* Temp range bar */}
              <div className="flex-1 flex justify-center">
                <TempRange high={high} low={low} />
              </div>

              {/* High temp */}
              <span className="text-white/90 text-sm font-medium w-8">{high}°</span>

              {/* Precipitation */}
              {pop > 0 && (
                <div className="flex items-center gap-1 w-10 justify-end">
                  <svg className="w-3 h-3 text-[var(--accent)]/60" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path d="M12 2v20M2 12h20" />
                  </svg>
                  <span className="text-xs text-[var(--accent)]/70 font-medium">
                    {Math.round(pop * 100)}%
                  </span>
                </div>
              )}

              {/* Wind */}
              {wind != null && (
                <span className="text-[10px] text-white/30 w-12 text-right hidden lg:inline">
                  {wind.toFixed(1)} m/s
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
