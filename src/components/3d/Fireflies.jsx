import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWeatherStore } from '../../store/weatherStore';

export default function Fireflies() {
  const isDaytime = useWeatherStore((s) => s.isDaytime);
  const weatherType = useWeatherStore((s) => s.weatherType);
  const pointsRef = useRef();

  const show = !isDaytime && (weatherType === 'clear' || weatherType === 'night');
  const count = show ? 80 : 0;

  const { positions, phases } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const ph = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = 0.5 + Math.random() * 3;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
      ph[i] = Math.random() * Math.PI * 2;
    }
    return { positions: pos, phases: ph };
  }, [count]);

  const sizes = useMemo(() => new Float32Array(count).fill(0.1), [count]);

  useFrame(({ clock }) => {
    if (!pointsRef.current || !show) return;
    const time = clock.elapsedTime;
    const pos = pointsRef.current.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      const phase = phases[i];
      pos[i * 3] += Math.sin(time * 0.5 + phase) * 0.003;
      pos[i * 3 + 1] += Math.sin(time * 0.7 + phase * 1.3) * 0.003;
      pos[i * 3 + 2] += Math.cos(time * 0.6 + phase * 0.7) * 0.003;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.material.opacity = 0.3 + Math.sin(time * 2 + phases[0]) * 0.3;
  });

  if (!show) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={count} array={sizes} itemSize={1} />
      </bufferGeometry>
      <pointsMaterial
        color="#aaff44"
        size={0.12}
        transparent
        opacity={0.5}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}
