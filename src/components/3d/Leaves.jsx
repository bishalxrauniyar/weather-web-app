import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useWeatherStore } from '../../store/weatherStore';

export default function Leaves() {
  const weatherType = useWeatherStore((s) => s.weatherType);
  const weather = useWeatherStore((s) => s.weather);
  const pointsRef = useRef();

  const show = weatherType === 'thunderstorm' || weatherType === 'rain' || (weather?.wind?.speed > 8);
  const count = show ? 300 : 0;

  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = Math.random() * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
      vel[i * 3] = 0.5 + Math.random() * 1.5;
      vel[i * 3 + 1] = -0.2 + Math.random() * 0.4;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    }
    return { positions: pos, velocities: vel };
  }, [count]);

  useFrame((_, delta) => {
    if (!pointsRef.current || !show) return;
    const pos = pointsRef.current.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      pos[i * 3] += velocities[i * 3] * delta * 5;
      pos[i * 3 + 1] += velocities[i * 3 + 1] * delta * 3;
      pos[i * 3 + 2] += velocities[i * 3 + 2] * delta * 3;
      if (pos[i * 3] > 30) {
        pos[i * 3] = -30;
        pos[i * 3 + 1] = Math.random() * 20;
      }
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  if (!show) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        color="#4a8a3a"
        size={0.2}
        transparent
        opacity={0.7}
        sizeAttenuation
      />
    </points>
  );
}
