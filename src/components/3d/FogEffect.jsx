import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWeatherStore } from '../../store/weatherStore';

export default function FogEffect() {
  const weatherType = useWeatherStore((s) => s.weatherType);
  const ref = useRef();
  const timeRef = useRef(0);

  const count = weatherType === 'mist' || weatherType === 'fog' ? 500 : 0;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = Math.random() * 8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    return pos;
  }, [count]);

  useFrame((_, delta) => {
    if (!ref.current || !count) return;
    timeRef.current += delta;
    const pos = ref.current.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      pos[i * 3] += Math.sin(timeRef.current * 0.1 + i) * delta * 0.05;
      pos[i * 3 + 2] += Math.cos(timeRef.current * 0.08 + i * 1.3) * delta * 0.05;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  if (!count) return null;

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        color="#aaaacc"
        size={0.5}
        transparent
        opacity={0.2}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}
