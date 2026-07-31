import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWeatherStore } from '../../store/weatherStore';

export default function Water() {
  const ref = useRef();
  const weatherType = useWeatherStore((s) => s.weatherType);
  const timeRef = useRef(0);

  const geo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(120, 120, 128, 128);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  const stormy = weatherType === 'thunderstorm' || weatherType === 'rain';
  const waveAmp = stormy ? 0.3 : weatherType === 'clear' ? 0.08 : 0.15;

  useFrame(({ clock }) => {
    timeRef.current = clock.elapsedTime;
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const wave1 = Math.sin(x * 0.1 + clock.elapsedTime * 0.5) * waveAmp;
      const wave2 = Math.sin(z * 0.08 + clock.elapsedTime * 0.7 + 1.3) * waveAmp * 0.6;
      const wave3 = Math.sin((x + z) * 0.06 + clock.elapsedTime * 0.9) * waveAmp * 0.4;
      pos.setY(i, -5 + wave1 + wave2 + wave3);
    }
    pos.needsUpdate = true;
    ref.current.geometry.computeVertexNormals();
  });

  const waterColor = stormy ? '#0a1520' : weatherType === 'snow' ? '#8aaabc' : weatherType === 'clear' ? '#1a6a9a' : '#1a3a5a';

  return (
    <mesh ref={ref} geometry={geo} position={[0, -5, 0]} receiveShadow>
      <meshStandardMaterial
        color={waterColor}
        roughness={stormy ? 0.4 : 0.2}
        metalness={0.8}
        transparent
        opacity={0.85}
        envMapIntensity={1.2}
      />
    </mesh>
  );
}
