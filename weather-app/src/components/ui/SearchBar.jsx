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
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 px-4 py-2.5 transition-all duration-300"
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: '14px',
          backdropFilter: 'blur(20px) saturate(150%)',
          boxShadow: focused
            ? '0 4px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 2px var(--accent-soft)'
            : 'inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <svg className="w-4 h-4 text-white/40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          placeholder="Search city..."
          role="combobox"
          aria-expanded={isOpen}
          aria-activedescendant={activeIndex >= 0 ? `sr-${activeIndex}` : undefined}
          aria-controls="search-results"
          className="bg-transparent text-white placeholder-white/30 outline-none w-full text-sm font-light"
        />
        {query && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            onClick={() => { setQuery(''); setIsOpen(false); inputRef.current?.focus(); }}
            className="text-white/30 hover:text-white/70 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </motion.button>
        )}
      </motion.div>

      <AnimatePresence>
        {isOpen && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-full mt-2 left-0 right-0 search-panel overflow-hidden z-50 max-h-60 overflow-y-auto p-1"
            id="search-results"
          >
            {suggestions.map((item, i) => (
              <motion.button
                key={i}
                id={`sr-${i}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                whileHover={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                onClick={() => item.lat ? handleSelect(item) : null}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-sm text-white/70 hover:text-white transition-colors rounded-xl ${activeIndex === i ? 'bg-white/10 text-white' : ''}`}
                disabled={!item.lat}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <svg className="w-3.5 h-3.5 text-white/30 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="truncate">{item.name}{item.state ? `, ${item.state}` : ''}{item.country ? `, ${item.country}` : ''}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {item.lat ? (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Toggle favorite"
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(item.name); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); toggleFavorite(item.name); } }}
                      className="text-white/20 hover:text-yellow-400 transition-colors cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill={favorites.includes(item.name) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </span>
                  ) : (
                    <span className="text-white/15 text-[10px] uppercase tracking-wider">recent</span>
                  )}
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
