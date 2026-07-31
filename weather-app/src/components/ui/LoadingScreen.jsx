import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useWeatherStore } from '../../store/weatherStore';
import Icon from './icons';

export default function LoadingScreen() {
  const [loading, setLoading] = useState(true);
  const weather = useWeatherStore((s) => s.weather);
  const isLoading = useWeatherStore((s) => s.isLoading);

  useEffect(() => {
    if (weather) {
      const timer = setTimeout(() => setLoading(false), 600);
      return () => clearTimeout(timer);
    }
  }, [weather]);

  useEffect(() => {
    const fallback = setTimeout(() => setLoading(false), 5000);
    return () => clearTimeout(fallback);
  }, []);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          key="loading"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black gap-8"
        >
          {/* Animated weather glyph */}
          <motion.div
            animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="text-[var(--accent)]"
          >
            <Icon name="partly-cloudy" size={72} />
          </motion.div>

          {/* Brand mark */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-[2.75rem] font-light tracking-[0.3em] text-white/85">
              WEATHERVERSE
            </h1>
            <p className="text-white/25 text-xs mt-3 tracking-[0.15em] uppercase">
              {isLoading ? 'Fetching weather data...' : 'Loading your experience'}
            </p>
          </motion.div>

          {/* Gradient progress bar */}
          <motion.div className="w-48 h-px rounded-full overflow-hidden bg-white/6">
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: '0%' }}
              transition={{
                duration: isLoading ? 2.5 : 1.8,
                ease: [0.4, 0, 0.2, 1],
                repeat: isLoading ? Infinity : 0,
                repeatDelay: 0.5,
              }}
              className="h-full w-full rounded-full bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
