import { useMemo } from 'react';
import { motion } from 'framer-motion';
import Icon from './icons';
import { toUnit, unitSymbol } from '../../storage/weatherUtils';

export default function DailyForecast({ forecast, units = 'metric' }) {
  const days = useMemo(() => {
    if (!forecast?.list) return [];

    const groups = new Map();
    forecast.list.forEach((item) => {
      const key = new Date(item.dt * 1000).toDateString();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });

    return [...groups.values()].slice(0, 10).map((items, idx) => {
      const mid = items[Math.floor(items.length / 2)];
      const temps = items.map((i) => toUnit(i.main.temp, units));
      const pops = items.map((i) => i.pop || 0);
      const date = new Date(items[0].dt * 1000);
      const today = idx === 0;

      return {
        label: today ? 'Today' : date.toLocaleDateString([], { weekday: 'short' }),
        icon: mid.weather[0].icon,
        cond: mid.weather[0].description,
        pop: Math.round(Math.max(...pops) * 100),
        min: Math.round(Math.min(...temps)),
        max: Math.round(Math.max(...temps)),
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
            className="day-row"
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
            </div>
            <span className="day-pop">{day.pop > 0 ? `${day.pop}%` : ''}</span>
            <div className="day-temps">
              <span className="max">{day.max}{unitSymbol(units)}</span>
              <span className="min">{day.min}{unitSymbol(units)}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}