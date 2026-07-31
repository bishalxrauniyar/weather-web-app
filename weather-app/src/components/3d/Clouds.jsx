import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWeatherStore } from '../../store/weatherStore';

const CLOUD_COUNT = 30;

function Cloud({ position, scale, color, speed }) {
  const ref = useRef();
  const startX = position[0];

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.position.x += delta * speed;
      if (Math.abs(ref.current.position.x - startX) > 40) {
        ref.current.position.x = startX;
      }
    }
  });

  const group = useMemo(() => {
    const g = new THREE.Group();
    const parts = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < parts; i++) {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.8 + Math.random() * 1.2, 8, 8),
        new THREE.MeshStandardMaterial({
          color,
          transparent: true,
          opacity: 0.6 + Math.random() * 0.3,
          roughness: 1,
          metalness: 0,
        })
      );
      sphere.position.set(
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 2
      );
      sphere.scale.set(
        1 + Math.random() * 0.5,
        1 + Math.random() * 0.3,
        1 + Math.random() * 0.5
      );
      g.add(sphere);
    }
    return g;
  }, [color]);

  return <primitive ref={ref} object={group.clone()} position={position} scale={scale} />;
}

export default function Clouds() {
  const weatherType = useWeatherStore((s) => s.weatherType);

  const cloudData = useMemo(() => {
    const count = weatherType === 'cloudy' || weatherType === 'thunderstorm' ? CLOUD_COUNT * 2 : weatherType === 'clear' ? 5 : CLOUD_COUNT;
    const baseColor = weatherType === 'thunderstorm' ? '#3a3a4a' : weatherType === 'rain' ? '#4a4a5a' : weatherType === 'snow' ? '#d0d0e0' : weatherType === 'night' ? '#1a1a2a' : '#e8e8f0';

    return Array.from({ length: count }, () => ({
      position: [
        (Math.random() - 0.5) * 80,
        5 + Math.random() * 15,
        (Math.random() - 0.5) * 80,
      ],
      scale: 1 + Math.random() * 2,
      color: baseColor,
      speed: 0.005 + Math.random() * 0.015,
    }));
  }, [weatherType]);

  return (
    <group>
      {cloudData.map((c, i) => (
        <Cloud key={i} {...c} />
      ))}
    </group>
  );
}
