import { useState } from 'react';
import { motion } from 'framer-motion';
import WeatherDetail from './WeatherDetail';

function SVGRing({ pct, color }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 56 56" className="gauge-ring">
      <circle
        cx="28" cy="28" r={r}
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="4"
        fill="none"
      />
      <circle
        cx="28" cy="28" r={r}
        stroke={color}
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        transform="rotate(-90 28 28)"
      />
    </svg>
  );
}

export default function GaugeRail({ side, weather }) {
  const isLeft = side === 'left';
  const [detailType, setDetailType] = useState(null);
  
  const windSpeed = weather?.wind?.speed ? Math.round(weather.wind.speed * 3.6) : '--';
  const windDir = weather?.wind?.deg;
  const humidity = weather?.main?.humidity || '--';
  const pressure = weather?.main?.pressure || '--';
  const visibility = weather?.visibility ? (weather.visibility / 1000).toFixed(0) : '--';
  const clouds = weather?.clouds?.all || '--';
  
  // Calculate UV index approximation (simplified)
  const uvIndex = weather?.clouds?.all != null ? Math.max(0, 11 - Math.round(weather.clouds.all / 10)) : 5;
  const uvPct = uvIndex / 11;

  const leftGauges = [
    { key: 'WIND', label: 'WIND', value: `${windSpeed} km/h`, sub: windDir ? `${['N','NE','E','SE','S','SW','W','NW'][Math.round(windDir/45)%8]} gusting` : 'Calm' },
    { key: 'HUMIDITY', label: 'HUMIDITY', value: `${humidity}%`, sub: humidity < 30 ? 'Dry' : humidity < 60 ? 'Comfortable' : 'Humid' },
    { 
      key: 'UV INDEX',
      label: 'UV INDEX', 
      ring: true,
      pct: uvPct,
      color: '#ffb25e'
    },
  ];

  const rightGauges = [
    { key: 'PRESSURE', label: 'PRESSURE', value: `${pressure}`, sub: 'hPa · steady' },
    { key: 'VISIBILITY', label: 'VISIBILITY', value: `${visibility} km`, sub: visibility > 10 ? 'Clear line' : 'Reduced' },
    { key: 'CLOUDS', label: 'CLOUDS', value: `${clouds}%`, sub: clouds < 20 ? 'Clear' : clouds < 50 ? 'Partly' : 'Overcast' },
  ];

  const gauges = isLeft ? leftGauges : rightGauges;

  return (
    <>
      <div className={`rail ${side}`}>
        {gauges.map((gauge, i) => (
          <motion.div
            key={gauge.label}
            initial={{ opacity: 0, x: isLeft ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
            className="glass gauge-card cursor-pointer hover:scale-105 transition-transform"
            onClick={() => setDetailType(gauge.key)}
          >
            <div className="gauge-label">{gauge.label}</div>
            {gauge.ring ? (
              <SVGRing pct={gauge.pct} color={gauge.color} />
            ) : (
              <>
                <div className="gauge-value">{gauge.value}</div>
                <div className="gauge-sub">{gauge.sub}</div>
              </>
            )}
            <div className="text-center mt-1">
              <span className="text-[9px] text-white/20 uppercase tracking-wider">Tap for details</span>
            </div>
          </motion.div>
        ))}
      </div>
      
      <WeatherDetail
        isOpen={!!detailType}
        onClose={() => setDetailType(null)}
        type={detailType}
        weather={weather}
      />
    </>
  );
}