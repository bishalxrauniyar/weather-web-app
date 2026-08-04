import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { useWeatherStore } from '../../store/weatherStore';
import Icon from './icons';

function SunriseSet({ sunrise, sunset }) {
  if (!sunrise || !sunset) return null;
  const now = Date.now();
  const dayLength = sunset - sunrise;
  const elapsed = now - sunrise;
  const progress = Math.max(0, Math.min(1, elapsed / dayLength));

  return (
    <div className="glass-tile px-4 py-3">
      <p className="label-text mb-2">Sun Position</p>
      <div className="relative h-8 flex items-center">
        <svg viewBox="0 0 100 24" className="w-full">
          <path d="M0 22 Q50 2 100 22" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <path
            d={`M0 22 Q50 2 100 22`}
            fill="none"
            stroke="var(--accent-warm)"
            strokeWidth="1.5"
            strokeDasharray={`${progress * 100} ${(1 - progress) * 100}`}
            strokeLinecap="round"
          />
          <circle cx={progress * 100} cy={22 - Math.sin(progress * Math.PI) * 20} r="2.5" fill="var(--accent-warm)" />
        </svg>
      </div>
      <div className="flex justify-between text-xs text-white/50 mt-1">
        <span>{new Date(sunrise).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <span>{new Date(sunset).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  );
}

function WindCompass({ speed, deg }) {
  if (speed == null) return null;
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const dir = dirs[Math.round(deg / 22.5) % 16];

  return (
    <div className="glass-tile px-4 py-3">
      <p className="label-text mb-2">Wind</p>
      <div className="flex items-center gap-3">
        <div className="relative w-12 h-12 shrink-0">
          <svg viewBox="0 0 48 48" className="w-full h-full">
            <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <circle cx="24" cy="24" r="12" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
            <motion.line
              x1="24" y1="24"
              x2={24 + Math.sin(deg * Math.PI / 180) * 16}
              y2={24 - Math.cos(deg * Math.PI / 180) * 16}
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            />
            <circle cx="24" cy="24" r="1.5" fill="var(--accent)" />
          </svg>
        </div>
        <div>
          <p className="text-lg font-medium text-white/90">{speed.toFixed(1)} m/s</p>
          <p className="text-xs text-white/50">{dir} ({Math.round(deg)}°)</p>
        </div>
      </div>
    </div>
  );
}

export default function WeatherCard() {
  const { weather, weatherType, location } = useWeatherStore();
  const tempRef = useRef(null);
  const [animTemp, setAnimTemp] = useState(0);

  useEffect(() => {
    if (!weather) return;
    const target = Math.round(weather.main.temp);
    gsap.to({ val: animTemp }, {
      val: target,
      duration: 1.4,
      ease: 'power3.out',
      onUpdate: function () { setAnimTemp(Math.round(this.targets()[0].val)); },
    });
  }, [weather, animTemp, weather?.main?.temp]);

  if (!weather) return null;

  const description = weather.weather[0].description;
  const feelsLike = Math.round(weather.main.feels_like);
  const humidity = weather.main.humidity;
  const windSpeed = weather.wind.speed;
  const windDeg = weather.wind.deg;
  const visibility = (weather.visibility / 1000).toFixed(1);
  const pressure = weather.main.pressure;
  const clouds = weather.clouds?.all;
  const sunrise = weather.sys?.sunrise ? weather.sys.sunrise * 1000 : null;
  const sunset = weather.sys?.sunset ? weather.sys.sunset * 1000 : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={`glass-panel p-7 w-full max-w-[24rem] ${weatherType ? `wx-${weatherType}` : ''}`}
    >
      {/* Hero */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <motion.h1
            key={weatherType}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="text-[var(--text-primary)] temp-glow leading-none flex items-start font-extralight"
            style={{ fontSize: '5.5rem', letterSpacing: '-0.04em' }}
          >
            <span ref={tempRef}>{animTemp}</span>
            <span className="text-3xl font-extralight text-white/45 ml-1 mt-2">°</span>
          </motion.h1>
          <p className="text-white/55 text-sm mt-3 capitalize tracking-wide font-light">
            {description}
          </p>
        </div>
        <motion.div
          key={weatherType + '-icon'}
          initial={{ rotate: -30, scale: 0, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-[var(--wx-tint,#7b9cff)] animate-float"
        >
          <Icon name={weatherType} size={56} />
        </motion.div>
      </div>

      {/* Location */}
      <div className="flex items-center gap-2 mt-4 mb-4">
        <svg className="w-3.5 h-3.5 text-white/40 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <h2 className="text-lg font-medium text-white/90">{location.name}</h2>
        <span className="text-xs text-white/30 ml-auto">
          {weather.sys?.country ? `${weather.sys.country}` : ''}
        </span>
      </div>

      <hr className="section-divider" />

      {/* Stats grid - 3x2 */}
      <div className="grid grid-cols-3 gap-2.5 mt-4">
        {[
          { label: 'Humidity', value: `${humidity}%`, icon: 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z' },
          { label: 'Wind', value: `${windSpeed} m/s`, icon: 'M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2' },
          { label: 'Visibility', value: `${visibility} km`, icon: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z' },
          { label: 'Pressure', value: `${pressure} hPa`, icon: 'M12 20V10 M18 20V4 M6 20v-4' },
          { label: 'Clouds', value: clouds != null ? `${clouds}%` : '--', icon: 'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z' },
          { label: 'Feels like', value: `${feelsLike}°`, icon: 'M12 2a4 4 0 0 0-4 4c0 2 2 3 2 3h4s2-1 2-3a4 4 0 0 0-4-4z M8 14h8 M8 17h6 M8 20h4' },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 + i * 0.05, duration: 0.5 }}
            className="glass-tile px-3 py-2.5"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <svg className="w-3 h-3 text-[var(--wx-tint,var(--accent))]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              <p className="label-text">{item.label}</p>
            </div>
            <p className="value-text text-sm">{item.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Bottom row: Sunrise/Sunset + Wind + Feels-like + Dew */}
      <div className="grid grid-cols-2 gap-2.5 mt-2.5">
        <SunriseSet sunrise={sunrise} sunset={sunset} />
        <WindCompass speed={windSpeed} deg={windDeg} />
      </div>
    </motion.div>
  );
}
