import { useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWeatherStore } from '../../store/weatherStore';

export default function Lightning() {
  const weatherType = useWeatherStore((s) => s.weatherType);
  const flashRef = useRef();
  const boltRef = useRef();
  const timeRef = useRef(0);
  const nextFlash = useRef(2 + Math.random() * 5);
  const flashDuration = useRef(0);

  const createBolt = useCallback(() => {
    if (!boltRef.current) return;
    const segments = 12;
    const points = [];
    let x = 0, y = 20, z = 0;
    points.push(new THREE.Vector3(x, y, z));
    for (let i = 0; i < segments; i++) {
      y -= 20 / segments;
      x += (Math.random() - 0.5) * 4;
      z += (Math.random() - 0.5) * 4;
      points.push(new THREE.Vector3(x, y + Math.random() * 2, z));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    boltRef.current.geometry.dispose();
    boltRef.current.geometry = geometry;
  }, []);

  useFrame((_, delta) => {
    if (weatherType !== 'thunderstorm' && weatherType !== 'rain') {
      if (flashRef.current) flashRef.current.intensity = 0;
      return;
    }

    timeRef.current += delta;
    flashDuration.current -= delta;

    if (flashDuration.current > 0) {
      const intensity = flashDuration.current * 8;
      if (flashRef.current) flashRef.current.intensity = Math.min(intensity, 5);
      if (boltRef.current) boltRef.current.visible = true;
    } else {
      if (flashRef.current) flashRef.current.intensity = 0;
      if (boltRef.current) boltRef.current.visible = false;

      if (timeRef.current >= nextFlash.current) {
        timeRef.current = 0;
        nextFlash.current = 3 + Math.random() * 8;
        flashDuration.current = 0.1 + Math.random() * 0.15;
        if (weatherType === 'thunderstorm') {
          createBolt();
        }
      }
    }
  });

  if (weatherType !== 'thunderstorm' && weatherType !== 'rain') return null;

  return (
    <group>
      <directionalLight ref={flashRef} position={[0, 30, 0]} intensity={0} color="#eef0ff" />
      <line ref={boltRef}>
        <bufferGeometry />
        <lineBasicMaterial color="#eef0ff" transparent opacity={0.8} />
      </line>
    </group>
  );
}
