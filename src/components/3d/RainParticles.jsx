import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWeatherStore } from '../../store/weatherStore';

export default function RainParticles() {
  const weatherType = useWeatherStore((s) => s.weatherType);
  const density = useWeatherStore((s) => s.particleDensity);
  const meshRef = useRef();

  const isRaining = weatherType === 'rain' || weatherType === 'thunderstorm' || weatherType === 'drizzle';
  const isHeavy = weatherType === 'thunderstorm';

  const count = isRaining ? Math.floor((isHeavy ? 15000 : 8000) * density) : 0;

  const { positions, velocities, lengths } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count);
    const len = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 100;
      pos[i * 3 + 1] = Math.random() * 50 - 5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 100;
      vel[i] = 0.3 + Math.random() * 0.4;
      len[i] = 0.3 + Math.random() * 0.4;
    }
    return { positions: pos, velocities: vel, lengths: len };
  }, [count]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('length', new THREE.BufferAttribute(lengths, 1));
    return geo;
  }, [positions, lengths]);

  useFrame((_, delta) => {
    if (!meshRef.current || !isRaining) return;
    const pos = meshRef.current.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] -= velocities[i] * delta * 30;
      pos[i * 3] -= 0.3 * delta * 10;
      if (pos[i * 3 + 1] < -5) {
        pos[i * 3 + 1] = 50;
        pos[i * 3] = (Math.random() - 0.5) * 100;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 100;
      }
    }
    meshRef.current.geometry.attributes.position.needsUpdate = true;
  });

  if (!isRaining) return null;

  return (
    <lineSegments ref={meshRef} geometry={geometry}>
      <lineBasicMaterial
        color={weatherType === 'thunderstorm' ? '#7788aa' : '#aaccee'}
        transparent
        opacity={0.5}
      />
    </lineSegments>
  );
}
