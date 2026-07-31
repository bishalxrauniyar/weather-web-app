import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useWeatherStore } from '../../store/weatherStore';

export default function Sun() {
  const weatherType = useWeatherStore((s) => s.weatherType);
  const isDaytime = useWeatherStore((s) => s.isDaytime);
  const ref = useRef();
  const glowRef = useRef();

  const visible = isDaytime && (weatherType === 'clear' || weatherType === 'partly-cloudy');

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.05;
    }
    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + Math.sin(Date.now() * 0.001) * 0.05);
    }
  });

  if (!visible) return null;

  return (
    <group position={[15, 25, -20]}>
      <mesh ref={glowRef}>
        <sphereGeometry args={[3, 16, 16]} />
        <meshBasicMaterial color="#ffdd44" transparent opacity={0.4} />
      </mesh>
      <mesh ref={ref}>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshBasicMaterial color="#ffee88" />
      </mesh>
      <directionalLight position={[0, 0, 0]} intensity={1.5} color="#ffeedd" />
      <pointLight intensity={0.5} color="#ffdd44" distance={50} />
    </group>
  );
}
