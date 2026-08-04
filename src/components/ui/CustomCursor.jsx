import { useEffect } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export default function CustomCursor() {
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const cursorSize = useMotionValue(6);
  const ringX = useSpring(cursorX, { stiffness: 180, damping: 28, mass: 0.5 });
  const ringY = useSpring(cursorY, { stiffness: 180, damping: 28, mass: 0.5 });

  useEffect(() => {
    const move = (e) => {
      cursorX.set(e.clientX - 3);
      cursorY.set(e.clientY - 3);
    };
    const down = () => cursorSize.set(4);
    const up = () => cursorSize.set(6);

    window.addEventListener('mousemove', move);
    window.addEventListener('mousedown', down);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mousedown', down);
      window.removeEventListener('mouseup', up);
    };
  }, [cursorX, cursorY, cursorSize]);

  return (
    <>
      {/* Core dot — slightly smaller, subtle glow */}
      <motion.div
        className="fixed top-0 left-0 rounded-full pointer-events-none z-[200] mix-blend-difference"
        style={{
          x: cursorX,
          y: cursorY,
          width: cursorSize,
          height: cursorSize,
          backgroundColor: '#fff',
          boxShadow: '0 0 8px rgba(255,255,255,0.4)',
        }}
      />
      {/* Ring follower — thinner, lower opacity */}
      <motion.div
        className="fixed top-0 left-0 rounded-full pointer-events-none z-[199]"
        style={{
          x: ringX,
          y: ringY,
          width: 28,
          height: 28,
          border: '1px solid rgba(255,255,255,0.18)',
          translateX: '-50%',
          translateY: '-50%',
        }}
      />
    </>
  );
}