import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWeatherStore } from '../../store/weatherStore';

const palettes = {
  clear:        { top: '#0a2a6a', mid: '#3a8ad0', bottom: '#6ab8e8', sun: '#ffe888' },
  'partly-cloudy': { top: '#1a3a6a', mid: '#4a7ab0', bottom: '#7aa8c8', sun: '#ffdd88' },
  cloudy:       { top: '#2a3a4a', mid: '#4a5a6a', bottom: '#6a7a8a', sun: '#ccbbaa' },
  rain:         { top: '#0a0a18', mid: '#1a1a2a', bottom: '#2a3a4a', sun: '#667788' },
  drizzle:      { top: '#0a0a1a', mid: '#1a2a3a', bottom: '#3a4a5a', sun: '#778899' },
  thunderstorm: { top: '#05050a', mid: '#0a0a12', bottom: '#1a1a22', sun: '#445566' },
  snow:         { top: '#2a4a6a', mid: '#6a9aba', bottom: '#aac8e0', sun: '#eeeeff' },
  mist:         { top: '#3a3a4a', mid: '#5a5a6a', bottom: '#7a8a9a', sun: '#ccbbaa' },
  night:        { top: '#05051a', mid: '#0a0a2a', bottom: '#0a0a1a', sun: '#222244' },
};

export default function Sky() {
  const weatherType = useWeatherStore((s) => s.weatherType);
  const isDaytime = useWeatherStore((s) => s.isDaytime);
  const domeRef = useRef();
  const sunRef = useRef();
  const glowRef = useRef();

  const pal = palettes[weatherType] || palettes.clear;
  const top = !isDaytime ? '#05051a' : pal.top;
  const mid = !isDaytime ? '#0a0a1a' : pal.mid;
  const bottom = !isDaytime ? '#0a0a18' : pal.bottom;

  const domeGeo = useMemo(() => {
    const geo = new THREE.SphereGeometry(70, 48, 48);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cTop = new THREE.Color(top);
    const cMid = new THREE.Color(mid);
    const cBottom = new THREE.Color(bottom);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = (y + 70) / 140;
      let c;
      if (t < 0.5) c = cTop.clone().lerp(cMid, t * 2);
      else c = cMid.clone().lerp(cBottom, (t - 0.5) * 2);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [top, mid, bottom]);

  useFrame(({ clock }) => {
    if (domeRef.current) domeRef.current.rotation.y += 0.0005;
    if (sunRef.current) sunRef.current.rotation.x += 0.001;
    if (glowRef.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 0.2) * 0.04;
      glowRef.current.scale.setScalar(s);
    }
  });

  const showSun = isDaytime && (weatherType === 'clear' || weatherType === 'partly-cloudy');

  return (
    <group>
      <mesh ref={domeRef} geometry={domeGeo}>
        <meshBasicMaterial vertexColors side={THREE.BackSide} />
      </mesh>

      {/* Sun */}
      <group position={[25, 20, -30]}>
        {showSun && (
          <>
            <mesh ref={glowRef}>
              <sphereGeometry args={[6, 16, 16]} />
              <meshBasicMaterial color={pal.sun} transparent opacity={0.08} />
            </mesh>
            <mesh ref={sunRef}>
              <sphereGeometry args={[2, 24, 24]} />
              <meshBasicMaterial color={pal.sun} />
            </mesh>
          </>
        )}
      </group>

      {/* Stars for night/storm */}
      {(!isDaytime || weatherType === 'thunderstorm') && (
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={3000}
              array={(() => {
                const p = new Float32Array(9000);
                for (let i = 0; i < 3000; i++) {
                  const theta = Math.random() * Math.PI * 2;
                  const phi = Math.acos(2 * Math.random() - 1);
                  const r = 65 + Math.random() * 5;
                  p[i * 3] = r * Math.sin(phi) * Math.cos(theta);
                  p[i * 3 + 1] = Math.abs(r * Math.cos(phi));
                  p[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
                }
                return p;
              })()}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial color="#ffffff" size={0.1} transparent opacity={0.7} sizeAttenuation />
        </points>
      )}
    </group>
  );
}
