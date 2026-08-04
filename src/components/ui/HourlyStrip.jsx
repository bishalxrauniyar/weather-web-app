import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon, { MetricIcon } from './icons';
import { toUnit, unitSymbol } from '../../storage/weatherUtils';

function HourlyDetail({ item, onClose, units = 'metric' }) {
  if (!item) return null;

  const time = new Date(item.dt * 1000);
  const hour = time.getHours();
  const temp = toUnit(item.main.temp, units);
  const feelsLike = toUnit(item.main.feels_like, units);
  const humidity = item.main.humidity;
  const windSpeed = Math.round((item.wind?.speed || 0) * 3.6);
  const description = item.weather[0].description;
  const pop = item.pop ? Math.round(item.pop * 100) : 0;
  const timeLabel = `${hour % 12 || 12}:00 ${hour < 12 ? 'AM' : 'PM'}`;

  const stats = [
    { icon: 'feelslike', label: 'Feels like', value: `${feelsLike}°` },
    { icon: 'drop', label: 'Humidity', value: `${humidity}%` },
    { icon: 'wind', label: 'Wind', value: `${windSpeed} km/h` },
    ...(pop > 0 ? [{ icon: 'droplet', label: 'Rain chance', value: `${pop}%` }] : []),
  ];

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
      />
      <motion.div
        key="panel"
        initial={{ opacity: 0, scale: 0.94, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 18 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="detail-panel pointer-events-auto w-full max-w-sm">
          <div className="flex items-center justify-between p-5 border-b border-white/10">
            <div className="flex items-center gap-3.5">
              <Icon name={item.weather[0].icon} size={38} className="text-white/90" />
              <div>
                <h2 className="text-lg font-semibold leading-tight">{timeLabel}</h2>
                <p className="text-sm text-white/50 capitalize">{description}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors text-white/60 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-5">
            <div className="flex items-end gap-2 mb-5">
              <span className="font-[var(--font-display)] text-5xl font-semibold leading-none tracking-tight">
                {temp}{unitSymbol(units)}
              </span>
              <span className="text-sm text-white/50 mb-1">{item.weather[0].main}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-[14px] bg-white/[0.04] border border-white/10 p-4">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.11em] text-white/50 mb-1.5">
                    <MetricIcon name={stat.icon} size={14} />
                    <span>{stat.label}</span>
                  </div>
                  <div className="text-xl font-semibold font-[var(--font-display)]">{stat.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function HourlyStrip({ forecast, units = 'metric' }) {
  const [selectedHour, setSelectedHour] = useState(null);

  if (!forecast?.list) return null;

  const hourly = forecast.list.slice(0, 12);

  return (
    <>
      <div className="hourly-scroll">
        {hourly.map((item, i) => {
          const time = new Date(item.dt * 1000);
          const hour = time.getHours();
          const isNow = i === 0;
          const label = isNow ? 'Now' : `${hour % 12 || 12}${hour < 12 ? 'a' : 'p'}`;
          const iconCode = item.weather[0].icon;
          const temp = toUnit(item.main.temp, units);
          const pop = item.pop ? Math.round(item.pop * 100) : 0;

          return (
            <motion.button
              key={item.dt}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="hourly-pill"
              onClick={() => setSelectedHour(item)}
            >
              <span className="pill-time">{label}</span>
              <Icon name={iconCode} size={22} className="text-white/85" />
              <span className="pill-temp">{temp}{unitSymbol(units)}</span>
              <span className="pill-pop">{pop > 0 ? `${pop}%` : ''}</span>
            </motion.button>
          );
        })}
      </div>

      {selectedHour && (
        <HourlyDetail item={selectedHour} onClose={() => setSelectedHour(null)} units={units} />
      )}
    </>
  );
}