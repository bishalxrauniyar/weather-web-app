import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useWeatherStore } from '../../store/weatherStore';

export default function Terrain() {
  const ref = useRef();
  const weatherType = useWeatherStore((s) => s.weatherType);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(80, 80, 80, 80);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const dist = Math.sqrt(x * x + z * z);
      const h = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 0.3
        + Math.sin(x * 0.1 + z * 0.08) * 0.15
        + Math.cos(x * 0.15 + z * 0.12) * 0.1;
      pos.setY(i, -5 + h * (dist < 10 ? 0 : 1));
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  const snowCover = weatherType === 'snow';
  const wetGround = weatherType === 'rain' || weatherType === 'thunderstorm';

  return (
    <mesh ref={ref} geometry={geometry} position={[0, -5, 0]}>
      <meshStandardMaterial
        color={snowCover ? '#e8e8f0' : wetGround ? '#3a3a4a' : '#4a7a5a'}
        roughness={snowCover ? 0.9 : wetGround ? 0.3 : 0.8}
        metalness={0}
        transparent={wetGround}
        opacity={wetGround ? 0.8 : 1}
      />
    </mesh>
  );
}
