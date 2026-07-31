import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWeatherStore } from '../../store/weatherStore';

function CloudCluster({ position, scale, color, density }) {
  const ref = useRef();
  const startX = position[0];
  const speed = 0.002 + Math.random() * 0.01;

  const group = useMemo(() => {
    const g = new THREE.Group();
    const count = 6 + Math.floor(Math.random() * 6);
    const baseColor = new THREE.Color(color);

    for (let i = 0; i < count; i++) {
      const r = (0.6 + Math.random() * 1.4) * scale;
      const mat = new THREE.MeshStandardMaterial({
        color: baseColor.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.05),
        transparent: true,
        opacity: (0.3 + Math.random() * 0.4) * density,
        roughness: 1,
        metalness: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(r, 7, 7),
        mat
      );
      mesh.position.set(
        (Math.random() - 0.5) * 2.5 * scale,
        (Math.random() - 0.5) * 0.6 * scale,
        (Math.random() - 0.5) * 2 * scale
      );
      mesh.scale.y = 0.5 + Math.random() * 0.4;
      g.add(mesh);
    }
    return g;
  }, [scale, color, density]);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.position.x += delta * speed;
      if (Math.abs(ref.current.position.x - startX) > 50) {
        ref.current.position.x = startX;
      }
    }
  });

  return <primitive ref={ref} object={group.clone()} position={position} />;
}

export default function VolumetricClouds() {
  const weatherType = useWeatherStore((s) => s.weatherType);
  const isDaytime = useWeatherStore((s) => s.isDaytime);

  const { clusters, showClouds } = useMemo(() => {
    const isOvercast = weatherType === 'cloudy' || weatherType === 'thunderstorm';
    const isRainy = weatherType === 'rain' || weatherType === 'drizzle';
    const isClear = weatherType === 'clear';
    const isMist = weatherType === 'mist';

    const count = isOvercast ? 50 : isRainy ? 30 : isClear ? 4 : isMist ? 12 : 18;

    const baseColor = weatherType === 'thunderstorm' ? '#3a3a4a'
      : weatherType === 'rain' ? '#4a4a5a'
      : weatherType === 'snow' ? '#c8d0e0'
      : !isDaytime ? '#1a1a2a'
      : '#e8e8f0';

    const density = isOvercast ? 1.0 : isRainy ? 0.7 : isClear ? 0.3 : 0.6;

    const clusters = Array.from({ length: count }, () => ({
      position: [
        (Math.random() - 0.5) * 100,
        6 + Math.random() * (isOvercast ? 18 : 12),
        (Math.random() - 0.5) * 100,
      ],
      scale: 0.5 + Math.random() * (isOvercast ? 3 : 2),
      color: baseColor,
      density,
    }));

    return { clusters, showClouds: !isClear || clusters.length > 0 };
  }, [weatherType, isDaytime]);

  if (!showClouds) return null;

  return (
    <group>
      {clusters.map((c, i) => (
        <CloudCluster key={i} {...c} />
      ))}
    </group>
  );
}
