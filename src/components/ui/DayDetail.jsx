import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo } from 'react';
import Icon, { MetricIcon } from './icons';
import {
  getWindDirection,
  getWeatherType,
  toUnit,
  unitSymbol,
} from '../../storage/weatherUtils';

/* Per-day summary computed from the day's 3-hour forecast blocks. Every
   figure the modal shows is derived here so the rail row and the modal
   always agree. */
function summarizeDay(items) {
  const temps = items.map((i) => i.main?.temp).filter((v) => v != null);
  const pops = items.map((i) => i.pop || 0);
  const rains = items.map((i) => i.rain?.['3h'] ?? i.rain?.['1h'] ?? 0);
  const winds = items.map((i) => i.wind?.speed ?? 0);
  const gusts = items.map((i) => i.wind?.gust ?? 0);
  const hums = items.map((i) => i.main?.humidity ?? 0);
  const vis = items.map((i) => i.visibility ?? 0);
  const clouds = items.map((i) => i.clouds?.all ?? 0);

  const tally = new Map();
  items.forEach((i) => {
    const id = i.weather?.[0]?.id;
    if (id != null) tally.set(id, (tally.get(id) || 0) + 1);
  });
  const topId = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const rep = items.find((i) => i.weather?.[0]?.id === topId) || items[0];

  const windIdx = winds.indexOf(Math.max(...winds));

  return {
    items,
    icon: rep.weather?.[0]?.icon || '01d',
    desc: rep.weather?.[0]?.description || '—',
    type: getWeatherType(rep.weather?.[0]?.id),
    min: temps.length ? Math.min(...temps) : null,
    max: temps.length ? Math.max(...temps) : null,
    pop: Math.round(Math.max(...pops) * 100),
    rain: rains.reduce((a, b) => a + b, 0),
    windMax: winds.length ? Math.max(...winds) : null,
    windGust: gusts.length ? Math.max(...gusts) : null,
    windDeg: windIdx >= 0 ? items[windIdx].wind?.deg : null,
    humidity: hums.length ? Math.round(hums.reduce((a, b) => a + b, 0) / hums.length) : null,
    visibility: vis.length ? Math.min(...vis) : null,
    clouds: clouds.length ? Math.round(clouds.reduce((a, b) => a + b, 0) / clouds.length) : null,
  };
}

function buildAdvice(day, units) {
  const notes = [];
  const kmh = (mps) => Math.round((mps || 0) * 3.6);

  if (day.type === 'thunderstorm') {
    notes.push('Thunderstorms are on the cards — plan for indoor time and avoid open fields.');
  }
  const wet = ['rain', 'drizzle', 'snow', 'thunderstorm'];
  if (wet.includes(day.type) && day.pop >= 50) {
    notes.push(
      `${day.pop}% chance of ${day.type === 'snow' ? 'snow' : 'precipitation'} across the day — ${day.type === 'snow' ? 'dress warm and watch for slippery roads' : 'keep an umbrella handy'}.`
    );
  } else if (day.pop >= 60) {
    notes.push(`${day.pop}% chance of precipitation — carry an umbrella to be safe.`);
  }
  if (day.windMax != null && kmh(day.windMax) >= 40) {
    notes.push(
      `Wind reaches ${kmh(day.windMax)} km/h${day.windGust ? `, gusts to ${kmh(day.windGust)} km/h` : ''} — secure loose items outdoors.`
    );
  }
  if (day.max != null && toUnit(day.max, units) >= 90 && units === 'imperial' || (day.max != null && day.max >= 32)) {
    notes.push('It will be hot — hydrate, wear light layers, and seek shade at midday.');
  }
  if (day.min != null && day.min <= 0) {
    notes.push('Sub-zero lows — frost possible, bundle up for the early hours.');
  }
  if (day.clouds != null && day.clouds >= 80 && day.type === 'cloudy') {
    notes.push('Mostly overcast — a dull, grey day with little sun.');
  }
  if (notes.length === 0) {
    notes.push('A calm, unremarkable day — nothing to plan around.');
  }
  return notes.join(' ');
}

function StatCard({ icon, label, value }) {
  return (
    <div className="day-stat-card">
      <MetricIcon name={icon} size={18} />
      <div className="min-w-0">
        <div className="ds-label">{label}</div>
        <div className="ds-value truncate">{value}</div>
      </div>
    </div>
  );
}

export default function DayDetail({ isOpen, onClose, day, weather, units }) {
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

  const data = useMemo(() => (day?.items?.length ? summarizeDay(day.items) : null), [day]);

  const t = (c) => (c == null ? '—' : `${Math.round(toUnit(c, units))}${unitSymbol(units)}`);
  const windTxt = (mps) =>
    mps == null
      ? '—'
      : units === 'imperial'
        ? `${Math.round(mps * 2.23694)} mph`
        : `${Math.round(mps * 3.6)} km/h`;
  const distTxt = (km) =>
    km == null
      ? '—'
      : units === 'imperial'
        ? `${(km * 0.621371).toFixed(1)} mi`
        : `${km.toFixed(1)} km`;

  if (!data) return null;

  const first = new Date(data.items[0].dt * 1000);
  const isToday =
    first.toDateString() === new Date().toDateString();
  const fullDate = first.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const sys = weather?.sys;
  const sunrise = isToday && sys?.sunrise ? new Date(sys.sunrise * 1000) : null;
  const sunset = isToday && sys?.sunset ? new Date(sys.sunset * 1000) : null;
  const time = (d) =>
    d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null;

  return (
    <AnimatePresence>
      {isOpen && (
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
            <div className="detail-panel pointer-events-auto w-full max-w-2xl p-[30px]! my-5!">
              <div
                className="-mx-[30px]! -mt-[30px]! h-[3px]"
                style={{
                  background: `linear-gradient(90deg, var(--accent), transparent 70%)`,
                }}
              />

              {/* Header */}
              <div className="relative overflow-hidden px-8 pt-7 pb-6">
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `radial-gradient(120% 140% at 0% 0%, var(--accent-soft), transparent 55%)`,
                  }}
                />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <motion.span
                      animate={{ y: [0, -3, 0], rotate: [0, -3, 0] }}
                      transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                      className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{
                        background: 'linear-gradient(145deg, var(--accent-soft), rgba(255,255,255,0.04))',
                        border: '1px solid var(--line-strong)',
                        color: 'var(--accent)',
                        boxShadow: '0 8px 24px -8px var(--accent-soft)',
                      }}
                    >
                      <Icon name={data.icon} size={26} />
                    </motion.span>
                    <div>
                      <h2 className="text-2xl font-semibold leading-tight tracking-tight">
                        {fullDate}
                      </h2>
                      <span className="block mt-1.5 text-sm text-white/45 capitalize">
                        {data.desc}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    aria-label="Close"
                    className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/12 hover:rotate-90 transition-all duration-200 text-white/60 hover:text-white shrink-0 border border-white/10"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Hero: high / low */}
              <div className="px-8">
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                >
                  <span className="label-text">Day high</span>
                  <div className="flex items-end gap-5 mt-2">
                    <p
                      className="text-6xl font-bold leading-none tracking-tight"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {t(data.max)}
                    </p>
                    <p className="pb-1.5 text-lg text-white/45" style={{ fontFamily: 'var(--font-display)' }}>
                      low <span className="text-white/75">{t(data.min)}</span>
                    </p>
                  </div>
                </motion.div>
              </div>

              {/* Hour-by-hour for this day */}
              {data.items.length > 1 && (
                <div className="px-8 mt-6">
                  <span className="label-text block mb-2.5">Hour by hour</span>
                  <div className="day-hour-strip scrollbar-hide">
                    {data.items.map((item) => {
                      const h = new Date(item.dt * 1000);
                      const pct = Math.round((item.pop || 0) * 100);
                      return (
                        <div key={item.dt} className="day-hour-chip">
                          <span className="chip-time">
                            {h.toLocaleTimeString('en-US', { hour: 'numeric' })}
                          </span>
                          <Icon
                            name={item.weather?.[0]?.icon || data.icon}
                            size={20}
                            className="text-white/85"
                          />
                          <span className="chip-temp">
                            {item.main?.temp != null
                              ? `${Math.round(toUnit(item.main.temp, units))}°`
                              : '—'}
                          </span>
                          <span className="chip-pop">{pct > 0 ? `${pct}%` : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Stats */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="mx-8 mt-6"
              >
                <div className="day-stat-grid">
                  <StatCard icon="droplet" label="Precipitation" value={data.pop > 0 ? `${data.pop}%` : 'Dry'} />
                  <StatCard icon="drop" label="Rain total" value={data.rain > 0 ? `${data.rain.toFixed(1)} mm` : 'None'} />
                  <StatCard
                    icon="wind"
                    label="Wind"
                    value={
                      data.windMax != null
                        ? `${windTxt(data.windMax)}${data.windDeg != null ? ' ' + getWindDirection(data.windDeg) : ''}`
                        : '—'
                    }
                  />
                  <StatCard icon="compass" label="Gusts" value={data.windGust != null ? windTxt(data.windGust) : 'Calm'} />
                  <StatCard icon="feelslike" label="Humidity" value={data.humidity != null ? `${data.humidity}%` : '—'} />
                  <StatCard icon="clouds" label="Cloud cover" value={data.clouds != null ? `${data.clouds}%` : '—'} />
                  <StatCard icon="eye" label="Visibility" value={distTxt((data.visibility || 0) / 1000)} />
                  {sunrise && sunset ? (
                    <>
                      <StatCard icon="sunrise" label="Sunrise" value={time(sunrise)} />
                      <StatCard icon="sunset" label="Sunset" value={time(sunset)} />
                    </>
                  ) : (
                    <StatCard icon="sunrise" label="Sunlight" value={isToday ? '—' : 'See sunrise on the day'} />
                  )}
                </div>
              </motion.div>

              {/* Practical advice */}
              <div className="px-8 pt-6 pb-8">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="relative overflow-hidden rounded-2xl p-5 pl-6"
                  style={{
                    background: `linear-gradient(135deg, var(--accent-soft), transparent 65%)`,
                    border: '1px solid var(--line-strong)',
                  }}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: 'var(--accent)' }} />
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.13em] mb-2"
                    style={{ color: 'var(--accent)' }}
                  >
                    What it means for you
                  </p>
                  <p className="text-sm text-white/75 leading-relaxed">{buildAdvice(data, units)}</p>
                </motion.div>
                <div className="flex justify-end mt-5">
                  <button
                    onClick={onClose}
                    className="text-sm font-semibold px-6 py-2.5 rounded-full transition-colors"
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
