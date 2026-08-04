import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { useWeatherStore } from '../../store/weatherStore';

const iconMap = {
  '01d': '\u2600\uFE0F', '01n': '\uD83C\uDF19',
  '02d': '\u26C5', '02n': '\uD83C\uDF19',
  '03d': '\u2601\uFE0F', '03n': '\u2601\uFE0F',
  '04d': '\u2601\uFE0F', '04n': '\u2601\uFE0F',
  '09d': '\uD83C\uDF27\uFE0F', '09n': '\uD83C\uDF27\uFE0F',
  '10d': '\uD83C\uDF27\uFE0F', '10n': '\uD83C\uDF27\uFE0F',
  '11d': '\u26C8\uFE0F', '11n': '\u26C8\uFE0F',
  '13d': '\u2744\uFE0F', '13n': '\u2744\uFE0F',
  '50d': '\uD83C\uDF2B\uFE0F', '50n': '\uD83C\uDF2B\uFE0F',
};

function TempSparkline({ data, width, height }) {
  if (!data?.length) return null;
  const temps = data.map((d) => d.temp);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const range = max - min || 1;
  const padding = 4;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const points = temps.map((t, i) => {
    const x = padding + (i / (temps.length - 1)) * chartW;
    const y = padding + ((max - t) / range) * chartH;
    return `${x},${y}`;
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p}`).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-warm)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path d={`${pathD} L${width - padding},${height} L${padding},${height} Z`} fill="url(#tempGrad)" />
      <motion.path
        d={pathD}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
      {temps.map((t, i) => (
        <circle key={i} cx={points[i].split(',')[0]} cy={points[i].split(',')[1]} r="1.5" fill="var(--accent)" />
      ))}
    </svg>
  );
}

export default function HourlyForecast() {
  const { forecast } = useWeatherStore();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });

  if (!forecast) return null;

  const hourly = forecast.list.slice(0, 8);
  const sparkData = hourly.map((item) => ({ temp: item.main.temp }));

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="glass-panel p-5 w-full max-w-md"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white/50 text-xs uppercase tracking-widest font-medium">Hourly Forecast</h3>
        <span className="text-white/20 text-[10px]">
          {new Date(forecast.list[0].dt * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' })}
        </span>
      </div>

      {/* Temp sparkline */}
      <div className="mb-3">
        <TempSparkline data={sparkData} width={240} height={40} />
      </div>

      {/* Hourly strip */}
      <div className="flex justify-between gap-1 overflow-x-auto fade-mask -mx-2 px-2">
        {hourly.map((item, i) => {
          const time = new Date(item.dt * 1000);
          const hour = time.getHours();
          const iconCode = item.weather[0].icon;
          const temp = Math.round(item.main.temp);
          const pop = item.pop;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.05 * i }}
              className="flex flex-col items-center gap-1 min-w-[48px] py-1"
            >
              <span className="text-white/35 text-[10px] font-medium">{hour}:00</span>
              <span className="text-base leading-none">{iconMap[iconCode] || '\u2600\uFE0F'}</span>
              <span className="text-white/85 text-sm font-semibold">{temp}°</span>
              {pop > 0 && (
                <span className="text-[10px] text-[var(--accent)]/70 font-medium">
                  {Math.round(pop * 100)}%
                </span>
              )}
              {/* Mini bar indicator */}
              <div className="w-4 h-[2px] rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-400/60 to-purple-400/60"
                  style={{ width: `${Math.round((pop || 0) * 100)}%` }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
