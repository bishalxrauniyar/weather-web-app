import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWeatherStore } from '../../store/weatherStore';

const weatherPalettes = {
  clear:        { top: '#0b2b6b', bottom: '#4a8fd4', sun: '#ffeeaa', haze: 0.01 },
  'partly-cloudy': { top: '#1a3a6a', bottom: '#6a9ad0', sun: '#ffdd88', haze: 0.03 },
  cloudy:       { top: '#2a3a4a', bottom: '#6a7a8a', sun: '#ccccaa', haze: 0.06 },
  rain:         { top: '#0a0a1a', bottom: '#2a3a4a', sun: '#666688', haze: 0.08 },
  drizzle:      { top: '#0a0a1a', bottom: '#3a4a5a', sun: '#777799', haze: 0.07 },
  thunderstorm: { top: '#05050a', bottom: '#1a1a2a', sun: '#444466', haze: 0.12 },
  snow:         { top: '#4a5a6a', bottom: '#b0c8e0', sun: '#eeffff', haze: 0.02 },
  mist:         { top: '#5a5a6a', bottom: '#8a9aaa', sun: '#ccbbaa', haze: 0.15 },
  night:        { top: '#05051a', bottom: '#0a0a2a', sun: '#222244', haze: 0.01 },
};

const sunPositions = {
  clear:        { theta: 0.6, phi: 0.8 },
  'partly-cloudy': { theta: 0.55, phi: 0.7 },
  cloudy:       { theta: 0.5, phi: 0.5 },
  rain:         { theta: 0.3, phi: 0.3 },
  thunderstorm: { theta: 0.2, phi: 0.2 },
  snow:         { theta: 0.4, phi: 0.6 },
  mist:         { theta: 0.35, phi: 0.4 },
  night:        { theta: -0.4, phi: 0.3 },
};

export default function Atmosphere() {
  const weatherType = useWeatherStore((s) => s.weatherType);
  const isDaytime = useWeatherStore((s) => s.isDaytime);
  const domeRef = useRef();
  const sunRef = useRef();
  const glowRef = useRef();
  const timeRef = useRef(0);

  const pal = weatherPalettes[weatherType] || weatherPalettes.clear;
  const sunPos = sunPositions[weatherType] || sunPositions.clear;

  const finalTop = !isDaytime ? '#05051a' : pal.top;
  const finalBottom = !isDaytime ? '#0a0a2a' : pal.bottom;

  const domeGeo = useMemo(() => {
    const geo = new THREE.SphereGeometry(80, 64, 64);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const top = new THREE.Color(finalTop);
    const bottom = new THREE.Color(finalBottom);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = (y + 80) / 160;
      const c = top.clone().lerp(bottom, Math.pow(t, 0.6));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [finalTop, finalBottom]);

  const starField = useMemo(() => {
    const count = 4000;
    const pos = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 75 + Math.random() * 5;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = Math.abs(r * Math.cos(phi));
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      sizes[i] = 0.05 + Math.random() * 0.15;
    }
    return { positions: pos, sizes };
  }, []);

  const sunTheta = sunPos.theta * Math.PI;
  const sunPhi = sunPos.phi * Math.PI * 0.4;
  const sunX = Math.sin(sunTheta) * Math.cos(sunPhi) * 60;
  const sunY = Math.sin(sunPhi) * 60 + 5;
  const sunZ = Math.cos(sunTheta) * Math.cos(sunPhi) * 60;

  useFrame(({ clock }) => {
    timeRef.current = clock.elapsedTime;
    if (domeRef.current) {
      domeRef.current.rotation.y += 0.0008;
    }
    if (sunRef.current) {
      sunRef.current.rotation.x += 0.002;
      sunRef.current.rotation.y += 0.003;
    }
    if (glowRef.current) {
      const pulse = 1 + Math.sin(clock.elapsedTime * 0.3) * 0.03;
      glowRef.current.scale.setScalar(pulse);
    }
  });

  const showStars = !isDaytime || weatherType === 'night' || weatherType === 'thunderstorm';
  const showSun = isDaytime && (weatherType === 'clear' || weatherType === 'partly-cloudy');

  return (
    <group>
      {/* Sky dome */}
      <mesh ref={domeRef} geometry={domeGeo}>
        <meshBasicMaterial vertexColors side={THREE.BackSide} />
      </mesh>

      {/* Stars */}
      {showStars && (
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={4000} array={starField.positions} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial
            color="#ffffff" size={0.12} transparent opacity={0.8}
            sizeAttenuation blending={THREE.AdditiveBlending} depthWrite={false}
          />
        </points>
      )}

      {/* Sun */}
      <group position={[sunX, sunY, sunZ]}>
        {showSun && (
          <>
            {/* Sun glow outer */}
            <mesh ref={glowRef}>
              <sphereGeometry args={[4, 16, 16]} />
              <meshBasicMaterial color={pal.sun} transparent opacity={0.2} />
            </mesh>
            {/* Sun core */}
            <mesh ref={sunRef}>
              <sphereGeometry args={[1.8, 32, 32]} />
              <meshBasicMaterial color={pal.sun} />
            </mesh>
            {/* Sun directional light */}
            <directionalLight intensity={isDaytime ? 2.0 : 0.3} color={pal.sun} />
            {/* Point light */}
            <pointLight intensity={isDaytime ? 0.8 : 0.1} color={pal.sun} distance={100} />
          </>
        )}
      </group>

      {/* Haze particles (always present - subtle atmospheric scattering sim) */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={200}
            array={(() => {
              const p = new Float32Array(600);
              for (let i = 0; i < 200; i++) {
                p[i * 3] = (Math.random() - 0.5) * 120;
                p[i * 3 + 1] = Math.random() * 40 + 5;
                p[i * 3 + 2] = (Math.random() - 0.5) * 120;
              }
              return p;
            })()}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color={pal.bottom} size={0.3} transparent
          opacity={pal.haze * 0.5} sizeAttenuation
          blending={THREE.AdditiveBlending} depthWrite={false}
        />
      </points>
    </group>
  );
}
