import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWeatherStore } from '../../store/weatherStore';

export default function SnowParticles() {
  const weatherType = useWeatherStore((s) => s.weatherType);
  const density = useWeatherStore((s) => s.particleDensity);
  const pointsRef = useRef();

  const isSnowing = weatherType === 'snow';
  const count = isSnowing ? Math.floor(10000 * density) : 0;

  const { positions, velocities, sizes } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count);
    const siz = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 100;
      pos[i * 3 + 1] = Math.random() * 50 - 5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 100;
      vel[i] = 0.05 + Math.random() * 0.1;
      siz[i] = 0.05 + Math.random() * 0.15;
    }
    return { positions: pos, velocities: vel, sizes: siz };
  }, [count]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, [positions, sizes]);

  useFrame((_, delta) => {
    if (!pointsRef.current || !isSnowing) return;
    const pos = pointsRef.current.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] -= velocities[i] * delta * 10;
      pos[i * 3] += Math.sin(Date.now() * 0.001 + i) * delta * 0.3;
      if (pos[i * 3 + 1] < -5) {
        pos[i * 3 + 1] = 50;
        pos[i * 3] = (Math.random() - 0.5) * 100;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 100;
      }
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  if (!isSnowing) return null;

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color="#ffffff"
        size={0.15}
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}
