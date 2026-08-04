import { motion } from 'framer-motion';
import { useWeatherStore } from '../../store/weatherStore';

export default function SoundToggle() {
  const { soundEnabled, toggleSound } = useWeatherStore();

  return (
    <motion.button
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      onClick={toggleSound}
      className="glass-pill w-11 h-11 flex items-center justify-center shrink-0"
      style={{ color: soundEnabled ? 'var(--accent)' : 'var(--text-muted)' }}
    >
      {soundEnabled ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <path d="M23 9l-6 6M17 9l6 6" />
        </svg>
      )}
    </motion.button>
  );
}