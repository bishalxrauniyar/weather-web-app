import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWeatherStore } from '../../store/weatherStore';

function IslandMesh({ seed, position, scale, color, weatherType }) {
  const ref = useRef();
  const baseY = position[1];
  const bobSpeed = 0.15 + Math.random() * 0.1;
  const bobAmp = 0.03 + Math.random() * 0.04;

  const geo = useMemo(() => {
    const s = 8 * scale;
    const segs = 32;
    const geo = new THREE.CircleGeometry(s, segs);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const dist = Math.sqrt(x * x + z * z) / s;
      const noise1 = Math.sin(x * 0.3 + seed) * Math.cos(z * 0.25 + seed * 2) * 0.5;
      const noise2 = Math.sin(x * 0.5 + seed * 3) * 0.3;
      const noise3 = Math.cos(z * 0.4 + seed * 5) * 0.2;
      const height = (noise1 + noise2 + noise3) * scale * 1.2;
      const falloff = Math.max(0, 1 - dist * dist);
      pos.setY(i, height * falloff * 1.5);
    }
    geo.computeVertexNormals();
    return geo;
  }, [scale, seed]);

  const snowCover = weatherType === 'snow';
  const wetGround = weatherType === 'rain' || weatherType === 'thunderstorm';

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = baseY + Math.sin(clock.elapsedTime * bobSpeed + seed) * bobAmp;
    }
  });

  return (
    <mesh ref={ref} geometry={geo} position={position} receiveShadow castShadow>
      <meshStandardMaterial
        color={snowCover ? '#e0e8f0' : wetGround ? '#2a3a3a' : color}
        roughness={snowCover ? 0.9 : wetGround ? 0.3 : 0.85}
        metalness={0}
        flatShading
      />
    </mesh>
  );
}

function IslandCliff({ seed, position, scale, color }) {
  const geo = useMemo(() => {
    const s = 6 * scale;
    const geo = new THREE.CylinderGeometry(s * 0.3, s, 4, 16);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const noise = Math.sin(x * 0.5 + seed) * Math.cos(z * 0.5 + seed) * 0.3;
      pos.setX(i, x + noise);
      pos.setZ(i, z + noise);
    }
    geo.computeVertexNormals();
    return geo;
  }, [scale, seed]);

  return (
    <mesh geometry={geo} position={[position[0], position[1] - 2 * scale, position[2]]} receiveShadow>
      <meshStandardMaterial color={color} roughness={0.95} metalness={0} flatShading />
    </mesh>
  );
}

export default function FloatingIslands() {
  const weatherType = useWeatherStore((s) => s.weatherType);
  const groupRef = useRef();

  const islands = useMemo(() => {
    const mainColor = weatherType === 'snow' ? '#c8d0d8' : weatherType === 'thunderstorm' ? '#1a2a2a' : '#4a7a5a';
    const cliffColor = weatherType === 'snow' ? '#a0a8b0' : weatherType === 'thunderstorm' ? '#0a1a1a' : '#3a5a3a';

    return [
      { seed: 1, position: [0, -3, 0], scale: 3.0, color: mainColor, cliffColor, hasCliff: true },
      { seed: 7, position: [-18, 2, -14], scale: 1.2, color: mainColor, cliffColor, hasCliff: true },
      { seed: 13, position: [16, 1, -12], scale: 0.8, color: mainColor, cliffColor, hasCliff: false },
      { seed: 42, position: [20, 3, 10], scale: 1.0, color: mainColor, cliffColor, hasCliff: true },
      { seed: 99, position: [-22, 4, 8], scale: 0.6, color: mainColor, cliffColor, hasCliff: false },
      { seed: 55, position: [-8, -1, -24], scale: 1.5, color: mainColor, cliffColor, hasCliff: true },
      { seed: 33, position: [8, 0, 22], scale: 0.9, color: mainColor, cliffColor, hasCliff: false },
      { seed: 77, position: [28, 5, -5], scale: 0.5, color: mainColor, cliffColor, hasCliff: false },
      { seed: 88, position: [-28, 3, -8], scale: 0.7, color: mainColor, cliffColor, hasCliff: false },
    ];
  }, [weatherType]);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.02) * 0.003;
    }
  });

  return (
    <group ref={groupRef}>
      {islands.map((island) => (
        <group key={island.seed}>
          {island.hasCliff && (
            <IslandCliff {...island} />
          )}
          <IslandMesh {...island} weatherType={weatherType} />
        </group>
      ))}
    </group>
  );
}
