import { useMemo } from 'react';

/* ── Inline SVG weather icons keyed by OpenWeather icon codes ──
   Each returns a 24x24 viewBox SVG element with currentColor stroke.
   Usage: <Icon name="01d" size={32} />  */

const paths = {
  /* ── Clear / sunny ── */
  '01d': () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ),

  /* ── Clear night (moon) ── */
  '01n': () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),

  /* ── Partly cloudy day ── */
  '02d': () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="12" r="3" />
      <path d="M8 5v1M8 18v1M3.5 7l.5.5M12.5 16.5l.5.5M4 12h1M13 12h1M3.5 17l.5-.5" />
      <path d="M10 14a4 4 0 0 0 6.5-3.5 4 4 0 0 0-4-4A4 4 0 0 0 10 14Z" />
    </svg>
  ),

  /* ── Partly cloudy night ── */
  '02n': () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 12.5A7 7 0 1 1 9.5 6 5 5 0 0 0 17 12.5z" />
      <path d="M10 14a4 4 0 0 0 6.5-3.5 4 4 0 0 0-4-4A4 4 0 0 0 10 14Z" />
    </svg>
  ),

  /* ── Cloudy / overcast ── */
  '03d': () => cloudIcon(),
  '03n': () => cloudIcon(),
  '04d': () => overcastIcon(),
  '04n': () => overcastIcon(),

  /* ── Drizzle ── */
  '09d': () => drizzleIcon(),
  '09n': () => drizzleIcon(),

  /* ── Rain ── */
  '10d': () => rainDayIcon(),
  '10n': () => rainNightIcon(),

  /* ── Thunderstorm ── */
  '11d': () => thunderIcon(),
  '11n': () => thunderIcon(),

  /* ── Snow ── */
  '13d': () => snowIcon(),
  '13n': () => snowIcon(),

  /* ── Mist / fog ── */
  '50d': () => mistIcon(),
  '50n': () => mistIcon(),
};

/* ── Sub-icons ── */

function cloudIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  );
}

function overcastIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 20h10a4.5 4.5 0 0 0 .5-9h-.5A6.5 6.5 0 0 0 4 7.5V8a5 5 0 0 0 2.5 12z" />
      <path d="M9 14a5 5 0 0 1 8.5-3.5" />
    </svg>
  );
}

function drizzleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 20h7a4.5 4.5 0 0 0 .5-9h-.5A5.5 5.5 0 0 0 4 8v.5a4 4 0 0 0 2.5 11.5z" />
      <path d="M8 14v3M12 14v3M16 14v3M10 17v3M14 17v3" />
    </svg>
  );
}

function rainDayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="3" />
      <path d="M5 4v1M10.5 3l.5.5M3 8h1M10 8h1" />
      <path d="M9 14h9a4 4 0 0 0 0-8h-1A4 4 0 0 0 9 14z" />
      <path d="M12 16v3M15 16v3M9 19v3M14 19v3" />
    </svg>
  );
}

function rainNightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12.5A7 7 0 1 1 11.5 6 5 5 0 0 0 19 12.5z" />
      <path d="M9 14h9a4 4 0 0 0 0-8h-1A4 4 0 0 0 9 14z" />
      <path d="M12 16v3M15 16v3M9 19v3M14 19v3" />
    </svg>
  );
}

function thunderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 16h9a4 4 0 0 0 0-8h-1A4 4 0 0 0 9 16z" />
      <path d="M13 10l-2 6h3l-1.5 4" />
    </svg>
  );
}

function snowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 20h7a4.5 4.5 0 0 0 .5-9h-.5A5.5 5.5 0 0 0 4 8v.5a4 4 0 0 0 2.5 11.5z" />
      <path d="M8 16l1.5 2M8 18l1.5-2M11.5 15l1.5 2M11.5 17l1.5-2M15 16l1.5 2M15 18l1.5-2" />
    </svg>
  );
}

function mistIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10h18M3 14h15M3 18h18M7 6h14" />
    </svg>
  );
}

/* ── Metric icons (consistent stroke style) ── */

const metricPaths = {
  feelslike: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 14.76V5a2 2 0 0 0-4 0v9.76a4 4 0 1 0 4 0z" />
      <path d="M12 9v6M10.5 15h3" />
    </svg>
  ),
  wind: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
      <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
      <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
    </svg>
  ),
  drop: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.7S6 9.5 6 14a6 6 0 0 0 12 0c0-4.5-6-11.3-6-11.3z" />
    </svg>
  ),
  uv: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  eye: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7.5 11-7.5S23 12 23 12s-4 7.5-11 7.5S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  gauge: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15l3.5-3.5" />
      <path d="M20.5 15.5a8.5 8.5 0 1 0-17 0" />
      <path d="M2 19h20" />
    </svg>
  ),
  sunrise: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v6M5.6 5.6l1.4 1.4M18.4 5.6L17 7M3 12h4M17 12h4" />
      <path d="M7 15a5 5 0 0 1 10 0" />
      <path d="M3 19h18" />
    </svg>
  ),
  sunset: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 13a5 5 0 0 1 10 0" />
      <path d="M3 13h4M17 13h4M12 3v6M5.6 5.6l1.4 1.4M18.4 5.6L17 7" />
      <path d="M3 19h18" />
    </svg>
  ),
  compass: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
    </svg>
  ),
  clouds: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  ),
  droplet: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z" />
    </svg>
  ),
};

/* ── WeatherType map (used by WeatherCard) ── */
const weatherTypeIcons = {
  clear:            '01d',
  'partly-cloudy':  '02d',
  cloudy:           '03d',
  rain:             '10d',
  drizzle:          '09d',
  thunderstorm:     '11d',
  snow:             '13d',
  mist:             '50d',
  night:            '01n',
};

/* ── React component ── */
export default function Icon({ name, size = 24, className = '' }) {
  const iconFn = useMemo(() => {
    const code = weatherTypeIcons[name] || name; /* accept weatherType string or direct code */
    return paths[code] || paths['01d'];
  }, [name]);

  return (
    <span
      className={`inline-flex shrink-0 ${className}`}
      style={{ width: size, height: size, color: 'inherit' }}
      aria-hidden="true"
    >
      {iconFn()}
    </span>
  );
}

export function MetricIcon({ name, size = 16, className = '' }) {
  const iconFn = useMemo(() => metricPaths[name] || metricPaths.feelslike, [name]);

  return (
    <span
      className={`inline-flex shrink-0 ${className}`}
      style={{ width: size, height: size, color: 'inherit' }}
      aria-hidden="true"
    >
      {iconFn()}
    </span>
  );
}