import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCitySearch } from '../../hooks/useWeather';
import { useWeatherStore } from '../../store/weatherStore';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef();
  const { data: results } = useCitySearch(query);
  const { setLocation, setSearchResults, recentSearches, favorites, toggleFavorite } = useWeatherStore();

  const suggestions = query.length >= 2 ? (results || []) : recentSearches.map((name) => ({ name, lat: 0, lon: 0 }));

  const handleSelect = useCallback((city) => {
    setLocation({ name: city.name, lat: city.lat, lon: city.lon });
    setQuery('');
    setIsOpen(false);
    setFocused(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  }, [setLocation]);

  useEffect(() => {
    if (results) setSearchResults(results);
  }, [results, setSearchResults]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && suggestions[activeIndex]?.lat) {
        e.preventDefault();
        handleSelect(suggestions[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      setFocused(false);
      setIsOpen(false);
      setActiveIndex(-1);
    }, 200);
  }, []);

  return (
    <div className="relative w-full">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center gap-3 px-5 py-3 transition-all duration-300"
        style={{
          background: focused ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
          border: '1px solid ' + (focused ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'),
          borderRadius: '16px',
          backdropFilter: 'blur(24px) saturate(150%)',
          boxShadow: focused
            ? '0 8px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px var(--accent-soft)'
            : 'inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <svg className="w-4 h-4 text-white/30 shrink-0 transition-colors duration-200" style={{ color: focused ? 'var(--accent)' : undefined }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => { setFocused(true); setIsOpen(true); }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Search city…"
          role="combobox"
          aria-expanded={isOpen}
          aria-activedescendant={activeIndex >= 0 ? `sr-${activeIndex}` : undefined}
          aria-controls="search-results"
          className="bg-transparent text-white placeholder-white/25 outline-none w-full text-sm font-light tracking-wide"
          style={{ caretColor: 'var(--accent)' }}
        />
        {query && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => { setQuery(''); setIsOpen(false); inputRef.current?.focus(); }}
            className="text-white/20 hover:text-white/60 transition-colors w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </motion.button>
        )}
      </motion.div>

      <AnimatePresence>
        {isOpen && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-full mt-3 left-0 right-0 search-panel overflow-hidden z-50 max-h-72 overflow-y-auto rounded-2xl p-2"
            style={{
              background: 'rgba(10, 14, 30, 0.85)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(28px) saturate(160%)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
            }}
            id="search-results"
          >
            {suggestions.map((item, i) => (
              <motion.div
                key={i}
                id={`sr-${i}`}
                role="button"
                tabIndex={0}
                aria-disabled={!item.lat}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.025, duration: 0.15 }}
                whileHover={{ backgroundColor: 'rgba(255,255,255,0.06)', x: 4 }}
                onClick={() => item.lat && handleSelect(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && item.lat) {
                    e.preventDefault();
                    handleSelect(item);
                  }
                }}
                className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm transition-colors rounded-xl cursor-pointer outline-none focus-visible:bg-white/10 ${activeIndex === i ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white'}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/30 shrink-0">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </span>
                  <span className="truncate">{item.name}{item.state ? `, ${item.state}` : ''}{item.country ? `, ${item.country}` : ''}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {item.lat ? (
                    <button
                      role="button"
                      tabIndex={0}
                      aria-label="Toggle favorite"
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(item); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); toggleFavorite(item); } }}
                      className={`transition-colors duration-200 ${favorites.some((f) => f.name === item.name) ? 'text-yellow-400' : 'text-white/15 hover:text-white/40'}`}
                    >
                      <svg className="w-3.5 h-3.5" fill={favorites.some((f) => f.name === item.name) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>
                  ) : (
                    <span className="text-white/15 text-[9px] uppercase tracking-widest font-semibold">Recent</span>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
