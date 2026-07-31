import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWeatherStore } from '../../store/weatherStore';

export default function Aurora() {
  const weatherType = useWeatherStore((s) => s.weatherType);
  const isDaytime = useWeatherStore((s) => s.isDaytime);
  const groupRef = useRef();
  const materialRef = useRef();

  const showAurora = !isDaytime && (weatherType === 'clear' || weatherType === 'partly-cloudy');

  const positions = useMemo(() => {
    const count = 800;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 60;
      arr[i * 3 + 1] = 15 + Math.random() * 10;
      arr[i * 3 + 2] = -40 + Math.random() * 20;
    }
    return arr;
  }, []);

  const colors = useMemo(() => {
    const count = 800;
    const arr = new Float32Array(count * 3);
    const palette = [
      new THREE.Color('#00ff88'),
      new THREE.Color('#00ccff'),
      new THREE.Color('#4488ff'),
      new THREE.Color('#88ffcc'),
      new THREE.Color('#aa66ff'),
    ];
    for (let i = 0; i < count; i++) {
      const c = palette[Math.floor(Math.random() * palette.length)];
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    groupRef.current.position.x = Math.sin(t * 0.05) * 3;
    groupRef.current.rotation.z = Math.sin(t * 0.03) * 0.05;
    if (materialRef.current) {
      materialRef.current.opacity = 0.5 + Math.sin(t * 0.2) * 0.15;
    }
  });

  if (!showAurora) return null;

  return (
    <group ref={groupRef} position={[0, 18, -35]}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={800} array={positions} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={800} array={colors} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          ref={materialRef}
          size={0.35}
          vertexColors
          transparent
          opacity={0.6}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </group>
  );
}