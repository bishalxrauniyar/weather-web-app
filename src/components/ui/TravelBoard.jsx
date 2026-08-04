import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useWeatherStore } from '../../store/weatherStore';
import { useWeatherByCoords } from '../../hooks/useWeather';
import { toUnit, unitSymbol } from '../../storage/weatherUtils';

function DestinationRow({ dest, onFly, onRemove }) {
  const units = useWeatherStore((s) => s.units);
  const { data, isLoading } = useWeatherByCoords(dest.lat, dest.lon);
  const temp = data?.main?.temp != null ? toUnit(data.main.temp, units) : null;
  const cond = data?.weather?.[0]?.description || '…';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl cursor-pointer group transition-colors"
      onClick={onFly}
      style={{ background: 'var(--panel-soft)', border: '1px solid var(--line)' }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onFly()}
      title={`Fly to ${dest.name}`}
    >
      <div className="flex items-center gap-3 min-w-0 text-left">
        <span className="w-2 h-2 rounded-full bg-[#39d9ff] shrink-0" />
        <span className="min-w-0">
          <span className="block text-sm text-white truncate">{dest.name}</span>
          <span className="block text-[11px] text-white/40 truncate">{cond}</span>
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-base text-white font-medium">
          {isLoading ? '—' : temp != null ? `${temp}${unitSymbol(units)}` : '—'}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${dest.name}`}
          className="text-white/25 hover:text-red-400 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}

export default function TravelBoard() {
  const {
    travelMode,
    setTravelMode,
    travelDestinations,
    addTravelDestination,
    removeTravelDestination,
    location,
    setLocation,
  } = useWeatherStore();

  const [justPinned, setJustPinned] = useState(false);

  const canPin =
    location?.lat != null &&
    !travelDestinations.some(
      (d) => Math.abs(d.lat - location.lat) < 0.1 && Math.abs(d.lon - location.lon) < 0.1
    );

  const handlePin = () => {
    if (!canPin) return;
    addTravelDestination({
      name: location.name,
      lat: location.lat,
      lon: location.lon,
    });
    setJustPinned(true);
    setTimeout(() => setJustPinned(false), 1400);
  };

  return (
    <section className="relative">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setTravelMode(!travelMode)}
          className="section-label flex items-center gap-2 uppercase tracking-widest"
          aria-expanded={travelMode}
        >
          <svg className="w-3.5 h-3.5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 13l-4.5 3.5L8 14l1.5-3.5L14 13zm0-1l5.5-5.5a1.5 1.5 0 0 0-2-2L12 10m2 2l-5.5-5.5a1.5 1.5 0 0 0-2 2L10 12" />
          </svg>
          Travel board
          <span className="text-white/25">{travelMode ? '▾' : '▸'}</span>
        </button>
        {travelMode && (
          <div className="flex items-center gap-2">
            <button
              onClick={handlePin}
              disabled={!canPin}
              className={`text-[11px] px-3 py-1.5 rounded-full border transition-colors ${
                justPinned
                  ? 'text-[#39d9ff] border-[#39d9ff]/50'
                  : canPin
                    ? 'text-white/70 border-white/15 hover:text-white hover:border-white/35'
                    : 'text-white/20 border-white/5 cursor-not-allowed'
              }`}
            >
              {justPinned ? '✓ Pinned' : '+ Pin this place'}
            </button>
            {travelDestinations.length > 0 && (
              <button
                onClick={() => {
                  for (let i = travelDestinations.length - 1; i >= 0; i--) removeTravelDestination(i);
                }}
                className="text-[11px] text-white/30 hover:text-red-400 px-2 py-1.5 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {travelMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2 py-1">
              {travelDestinations.length === 0 && (
                <p className="text-xs text-white/35 px-1 py-2">
                  Pin places to compare their weather — they'll appear on the globe as cyan dots.
                </p>
              )}
              {travelDestinations.map((d, i) => (
                <DestinationRow
                  key={`${d.name}-${i}`}
                  dest={d}
                  onFly={() => setLocation({ name: d.name, lat: d.lat, lon: d.lon })}
                  onRemove={() => removeTravelDestination(i)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
