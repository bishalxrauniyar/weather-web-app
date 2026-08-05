import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWeatherStore } from '../../store/weatherStore';

const THEMES = [
  {
    id: 'satellite',
    label: 'Satellite',
    hint: 'Live photo imagery',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
        <ellipse cx="12" cy="12" rx="4" ry="9" strokeWidth={1} />
        <line x1="3" y1="12" x2="21" y2="12" strokeWidth={1} />
      </svg>
    ),
  },
  {
    id: 'map',
    label: 'Map',
    hint: 'Flat terrain style',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth={1.5} d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" strokeLinecap="round" strokeLinejoin="round" />
        <path strokeWidth={1.5} d="M9 4v14M15 6v14" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'country',
    label: 'Countries',
    hint: 'Political borders',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth={1.5} d="M3 12c0-4.4 3.6-8 8-8h2l-2 3 2 2-1 3h3l1 2-1 1h-3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="9" strokeWidth={1} />
        <path strokeWidth={1} strokeLinecap="round" d="M3 12h18M12 3v18" />
      </svg>
    ),
  },
  {
    id: 'night',
    label: 'Night',
    hint: 'City lights everywhere',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
      </svg>
    ),
  },
];

export default function EarthThemePicker() {
  const earthTheme = useWeatherStore((s) => s.earthTheme);
  const setEarthTheme = useWeatherStore((s) => s.setEarthTheme);
  const [open, setOpen] = useState(false);
  const boxRef = useRef();

  useEffect(() => {
    const onDocClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('pointerdown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  const active = THEMES.find((t) => t.id === earthTheme) || THEMES[0];

  return (
    <div className="relative" ref={boxRef}>
      <button
        className="icon-btn"
        aria-label="Earth theme"
        title="Earth theme"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {active.icon}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full mt-2 w-56 rounded-2xl p-2 z-50"
            style={{
              background: 'rgba(10, 14, 30, 0.9)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(28px) saturate(160%)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
            }}
          >
            <p className="px-3 pt-1.5 pb-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-white/35">
              Earth style
            </p>
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setEarthTheme(t.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                  t.id === earthTheme ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                <span
                  className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                    t.id === earthTheme
                      ? 'text-[#39d9ff] border-[#39d9ff]/40 bg-[#39d9ff]/10'
                      : 'text-white/40 border-white/10 bg-white/[0.03]'
                  }`}
                >
                  {t.icon}
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm ${t.id === earthTheme ? 'text-white' : 'text-white/70'}`}>
                    {t.label}
                  </span>
                  <span className="block text-[11px] text-white/35 truncate">{t.hint}</span>
                </span>
                {t.id === earthTheme && (
                  <svg className="w-3.5 h-3.5 ml-auto text-[#39d9ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
