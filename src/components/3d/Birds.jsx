import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWeatherStore } from '../../store/weatherStore';

function Bird({ startPos, speed, wingSpeed }) {
  const groupRef = useRef();
  const wingL = useRef();
  const wingR = useRef();
  const phase = useRef(Math.random() * Math.PI * 2);

  useFrame((_, delta) => {
    phase.current += delta * wingSpeed;
    if (groupRef.current) {
      groupRef.current.position.x += delta * speed.x;
      groupRef.current.position.y += Math.sin(phase.current * 0.5) * delta * 0.3;
      groupRef.current.position.z += delta * speed.z;
      if (groupRef.current.position.x > 30) groupRef.current.position.x = -30;
      if (groupRef.current.position.x < -30) groupRef.current.position.x = 30;
    }
    if (wingL.current) wingL.current.rotation.z = Math.sin(phase.current) * 0.5;
    if (wingR.current) wingR.current.rotation.z = -Math.sin(phase.current) * 0.5;
  });

  return (
    <group ref={groupRef} position={startPos}>
      <mesh>
        <capsuleGeometry args={[0.05, 0.2, 4, 4]} />
        <meshBasicMaterial color="#333" />
      </mesh>
      <mesh ref={wingL} position={[-0.05, 0, 0]} rotation={[0, 0, 0.3]}>
        <planeGeometry args={[0.5, 0.2]} />
        <meshBasicMaterial color="#444" side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={wingR} position={[0.05, 0, 0]} rotation={[0, 0, -0.3]}>
        <planeGeometry args={[0.5, 0.2]} />
        <meshBasicMaterial color="#444" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export default function Birds() {
  const weatherType = useWeatherStore((s) => s.weatherType);
  const showBirds = weatherType === 'clear' || weatherType === 'partly-cloudy';

  const birds = useMemo(() => {
    if (!showBirds) return [];
    return Array.from({ length: 6 }, () => ({
      startPos: [
        (Math.random() - 0.5) * 40,
        12 + Math.random() * 8,
        (Math.random() - 0.5) * 20,
      ],
      speed: {
        x: 0.5 + Math.random() * 1,
        z: (Math.random() - 0.5) * 0.3,
      },
      wingSpeed: 4 + Math.random() * 4,
    }));
  }, [showBirds]);

  if (!showBirds) return null;

  return (
    <group>
      {birds.map((b, i) => (
        <Bird key={i} {...b} />
      ))}
    </group>
  );
}
