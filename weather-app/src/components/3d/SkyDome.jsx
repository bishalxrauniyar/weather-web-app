import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWeatherStore } from '../../store/weatherStore';

const gradients = {
  clear: { top: '#1a8fff', bottom: '#87ceeb', ambient: '#ffeedd' },
  cloudy: { top: '#4a5a6a', bottom: '#8a9aaa', ambient: '#cccccc' },
  rain: { top: '#1a1a2e', bottom: '#4a4a6a', ambient: '#555577' },
  thunderstorm: { top: '#0a0a1a', bottom: '#2a2a4a', ambient: '#333355' },
  snow: { top: '#c8d8e8', bottom: '#e8f0ff', ambient: '#ffffff' },
  mist: { top: '#7a7a8a', bottom: '#b0b0c0', ambient: '#aaaabc' },
  night: { top: '#0a0a1a', bottom: '#1a1a3a', ambient: '#111133' },
  'partly-cloudy': { top: '#3a7abd', bottom: '#9ab8e0', ambient: '#ddeeff' },
};

export default function SkyDome() {
  const weatherType = useWeatherStore((s) => s.weatherType);
  const isDaytime = useWeatherStore((s) => s.isDaytime);
  const meshRef = useRef();
  const timeRef = useRef(0);

  const colors = useMemo(() => {
    const base = gradients[weatherType] || gradients.clear;
    if (!isDaytime && weatherType !== 'night' && weatherType !== 'thunderstorm') {
      return { top: '#0a0a2a', bottom: '#1a1a4a', ambient: '#151535' };
    }
    return base;
  }, [weatherType, isDaytime]);

  const geometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(50, 64, 64);
    const pos = geo.attributes.position;
    const colorsArr = [];
    const topColor = new THREE.Color(colors.top);
    const bottomColor = new THREE.Color(colors.bottom);

    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = (y + 50) / 100;
      const c = topColor.clone().lerp(bottomColor, t);
      colorsArr.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colorsArr, 3));
    return geo;
  }, [colors]);

  useFrame((_, delta) => {
    timeRef.current += delta * 0.02;
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.008;
    }
  });

  const isStormy = weatherType === 'thunderstorm' || weatherType === 'rain';

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} opacity={isStormy ? 0.85 : 1} transparent />
    </mesh>
  );
}
