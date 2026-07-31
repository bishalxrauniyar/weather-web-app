import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useWeatherStore } from '../../store/weatherStore';

export default function Moon() {
  const isDaytime = useWeatherStore((s) => s.isDaytime);
  const weatherType = useWeatherStore((s) => s.weatherType);
  const ref = useRef();

  const visible = !isDaytime && weatherType !== 'thunderstorm' && weatherType !== 'rain';

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.02;
    }
  });

  if (!visible) return null;

  return (
    <group position={[-20, 20, -30]}>
      <mesh>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshStandardMaterial
          color="#eeeef8"
          roughness={0.8}
          metalness={0.1}
          emissive="#ccccee"
          emissiveIntensity={0.2}
        />
      </mesh>
      <mesh ref={ref}>
        <sphereGeometry args={[1.4, 32, 32]} />
        <meshBasicMaterial color="#ddddff" transparent opacity={0.15} />
      </mesh>
      <pointLight intensity={0.3} color="#8888ff" distance={40} />
    </group>
  );
}
