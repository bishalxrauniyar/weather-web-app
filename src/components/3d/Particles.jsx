import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWeatherStore } from '../../store/weatherStore';

function Rain({ density = 1 }) {
  const count = Math.round(5000 * density);
  const ref = useRef();

  const positions = useMemo(() => {
    const p = new Float32Array(count * 6);
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 26;
      const y = Math.random() * 34 - 6;
      const z = (Math.random() - 0.5) * 22 - 4;
      const len = 0.9 + Math.random() * 1.1;
      p[i * 6] = x;
      p[i * 6 + 1] = y;
      p[i * 6 + 2] = z;
      p[i * 6 + 3] = x - 0.15;
      p[i * 6 + 4] = y - len;
      p[i * 6 + 5] = z;
    }
    return p;
  }, [count]);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  useFrame((_, dt) => {
    if (!ref.current) return;
    const p = ref.current.geometry.attributes.position.array;
    const fall = 0.5 * dt * 40;
    const drift = 0.25 * dt * 15;
    for (let i = 0; i < count; i++) {
      p[i * 6 + 1] -= fall;
      p[i * 6 + 4] -= fall;
      p[i * 6] -= drift;
      p[i * 6 + 3] -= drift;
      if (p[i * 6 + 4] < -6) {
        const x = (Math.random() - 0.5) * 26;
        const y = 28 + Math.random() * 6;
        const z = (Math.random() - 0.5) * 22 - 4;
        const len = 0.9 + Math.random() * 1.1;
        p[i * 6] = x;
        p[i * 6 + 1] = y;
        p[i * 6 + 2] = z;
        p[i * 6 + 3] = x - 0.15;
        p[i * 6 + 4] = y - len;
        p[i * 6 + 5] = z;
      }
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <lineSegments ref={ref} geometry={geometry}>
      <lineBasicMaterial color="#7f9cc8" transparent opacity={0.4} />
    </lineSegments>
  );
}

function Snow({ density = 1 }) {
  const count = Math.round(6000 * density);
  const ref = useRef();
  const vel = useMemo(() => {
    const v = new Float32Array(count);
    for (let i = 0; i < count; i++) v[i] = 0.03 + Math.random() * 0.08;
    return v;
  }, [count]);

  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 80;
      p[i * 3 + 1] = Math.random() * 50 - 5;
      p[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }
    return p;
  }, [count]);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  useFrame(({ clock }, dt) => {
    if (!ref.current) return;
    const p = ref.current.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      p[i * 3 + 1] -= vel[i] * dt * 12;
      p[i * 3] += Math.sin(clock.elapsedTime * 0.3 + i) * dt * 0.4;
      if (p[i * 3 + 1] < -5) {
        p[i * 3 + 1] = 45 + Math.random() * 5;
        p[i * 3] = (Math.random() - 0.5) * 80;
        p[i * 3 + 2] = (Math.random() - 0.5) * 80;
      }
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial color="#ffffff" size={0.12} transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
    </points>
  );
}

function Dust() {
  const count = 400;
  const ref = useRef();

  const { positions, phases } = useMemo(() => {
    const p = new Float32Array(count * 3);
    const ph = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 40;
      p[i * 3 + 1] = Math.random() * 12;
      p[i * 3 + 2] = (Math.random() - 0.5) * 40;
      ph[i] = Math.random() * Math.PI * 2;
    }
    return { positions: p, phases: ph };
  }, []);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const p = ref.current.geometry.attributes.position.array;
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const ph = phases[i];
      p[i * 3] += Math.sin(t * 0.08 + ph) * 0.005;
      p[i * 3 + 1] += Math.sin(t * 0.12 + ph * 1.3) * 0.003;
      p[i * 3 + 2] += Math.cos(t * 0.1 + ph * 0.7) * 0.005;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial color="#ddccaa" size={0.06} transparent opacity={0.25} sizeAttenuation blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
}

function Fireflies() {
  const count = 60;
  const ref = useRef();

  const { positions, phases } = useMemo(() => {
    const p = new Float32Array(count * 3);
    const ph = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 25;
      p[i * 3 + 1] = 0.5 + Math.random() * 4;
      p[i * 3 + 2] = (Math.random() - 0.5) * 25;
      ph[i] = Math.random() * Math.PI * 2;
    }
    return { positions: p, phases: ph };
  }, []);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const p = ref.current.geometry.attributes.position.array;
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const ph = phases[i];
      p[i * 3] += Math.sin(t * 0.4 + ph) * 0.008;
      p[i * 3 + 1] += Math.sin(t * 0.6 + ph * 1.3) * 0.006;
      p[i * 3 + 2] += Math.cos(t * 0.5 + ph * 0.7) * 0.008;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
    ref.current.material.opacity = 0.3 + Math.sin(t * 2) * 0.25;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial color="#aaff44" size={0.15} transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
    </points>
  );
}

function Leaves({ density = 1 }) {
  const count = Math.round(150 * density);
  const ref = useRef();
  const vel = useMemo(() => {
    const v = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      v[i * 3] = 0.4 + Math.random() * 1.2;
      v[i * 3 + 1] = -0.1 + Math.random() * 0.2;
      v[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    }
    return v;
  }, [count]);

  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 50;
      p[i * 3 + 1] = Math.random() * 15;
      p[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    return p;
  }, [count]);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  useFrame((_, dt) => {
    if (!ref.current) return;
    const p = ref.current.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      p[i * 3] += vel[i * 3] * dt * 5;
      p[i * 3 + 1] += vel[i * 3 + 1] * dt * 3;
      p[i * 3 + 2] += vel[i * 3 + 2] * dt * 3;
      if (p[i * 3] > 25) {
        p[i * 3] = -25;
        p[i * 3 + 1] = Math.random() * 15;
      }
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial color="#5a9a3a" size={0.2} transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

function Mist({ density = 1 }) {
  const count = Math.round(300 * density);
  const ref = useRef();

  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 50;
      p[i * 3 + 1] = Math.random() * 6;
      p[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    return p;
  }, [count]);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  useFrame(({ clock }, dt) => {
    if (!ref.current) return;
    const p = ref.current.geometry.attributes.position.array;
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      p[i * 3] += Math.sin(t * 0.05 + i) * dt * 0.1;
      p[i * 3 + 2] += Math.cos(t * 0.04 + i * 1.3) * dt * 0.1;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial color="#8888aa" size={0.6} transparent opacity={0.12} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
    </points>
  );
}

export default function Particles() {
  const weatherType = useWeatherStore((s) => s.weatherType);
  const isDaytime = useWeatherStore((s) => s.isDaytime);
  const density = useWeatherStore((s) => s.particleDensity);
  const perf = useWeatherStore((s) => s.performanceMultiplier);
  const adaptiveDensity = Math.max(0.35, density * perf);

  const show = !isDaytime && (weatherType === 'clear' || weatherType === 'night');

  return (
    <group>
      {(weatherType === 'rain' || weatherType === 'drizzle' || weatherType === 'thunderstorm') && <Rain density={adaptiveDensity} />}
      {weatherType === 'snow' && <Snow density={adaptiveDensity} />}
      {weatherType === 'mist' && <Mist density={adaptiveDensity} />}
      {(weatherType === 'clear' || weatherType === 'partly-cloudy' || weatherType === 'cloudy') && <Dust />}
      {show && <Fireflies />}
      {(weatherType === 'thunderstorm' || weatherType === 'rain') && <Leaves density={adaptiveDensity} />}
    </group>
  );
}
