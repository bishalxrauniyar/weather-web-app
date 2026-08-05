import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useWeatherStore } from '../../store/weatherStore';
import Globe, { globeFocus, sunBus, camAnchor } from './Globe';
import Particles from './Particles';
import Sky from './Sky';
import Aurora from './Aurora';

function CameraSystem() {
  const { camera } = useThree();
  const target = useRef({ x: 0, y: 0 });
  const breath = useRef(0);

  useEffect(() => {
    const onMove = (e) => {
      target.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const reduced = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  /* On mobile the weather rail is a bottom sheet, so the globe must sit in
     the top band — aim the idle camera down toward the earth's centre.
     When the rail is collapsed (map mode) the globe takes the whole screen
     and the camera returns to the standard centred view. */
  const narrow = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches,
    []
  );
  const collapsed = useWeatherStore((s) => s.detailsCollapsed);
  const mapMode = narrow && collapsed;

  useFrame(({ clock }, delta) => {
    breath.current += delta * 0.2;

    const k = reduced ? 1 : Math.min(1, delta);

    /* While a location is focused, the globe owns the camera distance and
       we ray-aim at the pin's actual world position — the camera sits on the
       centre→pin line at the focus distance, so the clicked spot is always
       dead-centre, even while the globe is still tumbling. */
    if (globeFocus.active) {
      const d = globeFocus.dist;
      const dx = globeFocus.pinX - globeFocus.cx;
      const dy = globeFocus.pinY - globeFocus.cy;
      const dz = globeFocus.pinZ - globeFocus.cz;
      const len = Math.hypot(dx, dy, dz) || 1;
      const tx = globeFocus.cx + (dx / len) * d;
      const ty = globeFocus.cy + (dy / len) * d;
      const tz = globeFocus.cz + (dz / len) * d;
      const fly = k * 1.2;
      camera.position.x += (tx - camera.position.x) * fly;
      camera.position.y += (ty - camera.position.y) * fly;
      camera.position.z += (tz - camera.position.z) * fly;
      camera.lookAt(globeFocus.pinX, globeFocus.pinY, globeFocus.pinZ);
      return;
    }

    /* While the cursor-anchored wheel zoom is active, the anchor owns the
       camera — the idle drift must not fight the user's zoom-in (it was
       pushing the camera back out and stalling deep zooms). The anchor is
       released on click/drag/arrow/focus, so this yields only mid-wheel. */
    if (camAnchor.active) return;

    const tx = target.current.x * 1.8 + Math.sin(clock.elapsedTime * 0.01) * 0.2;
    /* ty=3 + aim 0 puts the globe dead-centre (projected NDC y ≈ 0) in map
       mode; ty=3.4 + aim -3.8 lifts it into the top band on mobile. */
    const ty = (mapMode ? 3 : narrow ? 3.4 : 2) + target.current.y * 0.6 + Math.sin(breath.current) * 0.03;
    const tz = 10.5 + Math.sin(clock.elapsedTime * 0.008) * 0.15;

    camera.position.x += (tx - camera.position.x) * k * 0.5;
    camera.position.y += (ty - camera.position.y) * k * 0.5;
    camera.position.z += (tz - camera.position.z) * k * 0.4;

    camera.lookAt(
      target.current.x * 0.2,
      (mapMode ? 0 : narrow ? -3.8 : 0) + Math.sin(clock.elapsedTime * 0.015) * 0.08,
      target.current.y * 0.1,
    );
  });

  return null;
}

function PerformanceAutoTune({ onDprCap }) {
  const setPerformanceProfile = useWeatherStore((s) => s.setPerformanceProfile);
  const accTime = useRef(0);
  const accFrames = useRef(0);
  const lastTier = useRef('high');

  useFrame((_, delta) => {
    accTime.current += delta;
    accFrames.current += 1;
    if (accTime.current < 1.6) return;

    const fps = accFrames.current / accTime.current;
    accTime.current = 0;
    accFrames.current = 0;

    let nextTier = 'high';
    let multiplier = 1;
    let dprCap = 2;
    if (fps < 43) {
      nextTier = 'low';
      multiplier = 0.58;
      dprCap = 1.25;
    } else if (fps < 53) {
      nextTier = 'medium';
      multiplier = 0.78;
      dprCap = 1.6;
    }

    if (lastTier.current !== nextTier) {
      lastTier.current = nextTier;
      setPerformanceProfile({ tier: nextTier, multiplier });
      onDprCap(dprCap);
    }
  });

  return null;
}

function Lighting() {
  const weatherType = useWeatherStore((s) => s.weatherType);
  const isDaytime = useWeatherStore((s) => s.isDaytime);
  const earthTheme = useWeatherStore((s) => s.earthTheme);
  const sunRef = useRef();
  const sunTargetRef = useRef();
  const isNightTheme = earthTheme === 'night';

  const config = useMemo(() => {
    const night = !isDaytime || weatherType === 'night';
    const storm = weatherType === 'thunderstorm';
    const overcast = weatherType === 'cloudy' || weatherType === 'rain';

    return {
      ambient: isNightTheme ? 0.1 : night ? 0.08 : storm ? 0.1 : overcast ? 0.2 : 0.35,
      hemiIntensity: isNightTheme ? 0.18 : night ? 0.15 : overcast ? 0.45 : 0.7,
      hemiSky: isNightTheme ? '#0a0a2a' : night ? '#0a0a2a' : storm ? '#1a1a2a' : overcast ? '#4a5a6a' : '#87ceeb',
      hemiGround: isNightTheme ? '#0a0a0a' : night ? '#0a0a0a' : storm ? '#0a0a10' : '#362d24',
    };
  }, [weatherType, isDaytime, isNightTheme]);

  /* Orbit the sun light around the globe so it always strikes the true
     day side — the lit half matches the terminator and the real time of day. */
  useFrame(() => {
    if (!sunRef.current) return;
    const c = sunBus.center;
    sunRef.current.position.set(
      c.x + sunBus.dir.x * 12,
      c.y + sunBus.dir.y * 12,
      c.z + sunBus.dir.z * 12
    );
    /* Aim the light at the globe's centre (not the world origin) so the
       day side sits exactly under the sun's subpoint. */
    if (sunTargetRef.current) sunTargetRef.current.position.set(c.x, c.y, c.z);
  });

  /* The light's target can't be assigned in JSX (ref not mounted yet), so
     wire it up once the objects exist. */
  useEffect(() => {
    if (sunRef.current && sunTargetRef.current) {
      sunRef.current.target = sunTargetRef.current;
    }
  }, []);

  return (
    <>
      <ambientLight intensity={config.ambient} color="#b0c8ff" />
      <hemisphereLight
        args={[new THREE.Color(config.hemiSky), new THREE.Color(config.hemiGround), config.hemiIntensity]}
      />
      <directionalLight
        ref={sunRef}
        position={[10, 20, 5]}
        intensity={isNightTheme ? 0.25 : isDaytime ? 1.7 : 0.12}
        color={isDaytime ? '#ffe8c8' : '#4466aa'}
      />
      <object3D ref={sunTargetRef} position={[0, -1.3, -3.5]} />
      <pointLight position={[-5, 10, -10]} intensity={isNightTheme ? 0.1 : isDaytime ? 0.35 : 0.06} color="#6688cc" />
      <pointLight position={[0, 2, 12]} intensity={isNightTheme ? 0.12 : isDaytime ? 0.4 : 0.05} color="#cfe0ff" />
    </>
  );
}

function Ground() {
  const weatherType = useWeatherStore((s) => s.weatherType);
  const isDaytime = useWeatherStore((s) => s.isDaytime);

  const color = useMemo(() => {
    if (weatherType === 'snow') return '#d0d8e0';
    if (weatherType === 'rain' || weatherType === 'thunderstorm') return '#1a2a2a';
    if (!isDaytime) return '#0a0a10';
    return '#1a2a1a';
  }, [weatherType, isDaytime]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5, 0]}>
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial color={color} roughness={0.9} metalness={0} />
    </mesh>
  );
}

function SceneContent() {
  return (
    <>
      <Lighting />
      <Ground />
      <Globe />
      <Sky />
      <Aurora />
      <Particles />
    </>
  );
}

function skyBackground(weatherType, isDaytime) {
  if (!isDaytime) {
    return 'radial-gradient(130% 100% at 70% 0%, #10163a 0%, #05051a 50%, #0a0a18 100%)';
  }
  switch (weatherType) {
    case 'cloudy': return 'linear-gradient(180deg, #2a3a4a 0%, #4a5a6a 60%, #6a7a8a 100%)';
    case 'rain':
    case 'drizzle': return 'linear-gradient(180deg, #0a0a18 0%, #1a1a2a 60%, #2a3a4a 100%)';
    case 'thunderstorm': return 'linear-gradient(180deg, #05050a 0%, #0a0a12 60%, #1a1a22 100%)';
    case 'snow': return 'linear-gradient(180deg, #2a4a6a 0%, #6a9aba 60%, #aac8e0 100%)';
    case 'mist': return 'linear-gradient(180deg, #3a3a4a 0%, #5a5a6a 60%, #7a8a9a 100%)';
    default: return 'linear-gradient(180deg, #0a2a6a 0%, #3a8ad0 55%, #6ab8e8 100%)';
  }
}

export default function WeatherScene() {
  const weatherType = useWeatherStore((s) => s.weatherType);
  const isDaytime = useWeatherStore((s) => s.isDaytime);
  const earthTheme = useWeatherStore((s) => s.earthTheme);

  const bg = useMemo(
    () => skyBackground(earthTheme === 'night' ? 'night' : weatherType, earthTheme === 'night' ? false : isDaytime),
    [weatherType, isDaytime, earthTheme]
  );

  /* If the GPU context is lost and can't restore itself, remount the
     canvas entirely so the scene comes back instead of staying blank. */
  const [ctxKey, setCtxKey] = useState(0);
  const [dprCap, setDprCap] = useState(2);
  const lostAt = useRef(null);
  const rebootTimer = useRef(null);

  useEffect(() => () => clearTimeout(rebootTimer.current), []);

  return (
    <div className="fixed inset-0" style={{ background: bg }}>
      <Canvas
        key={ctxKey}
        camera={{ position: [0, 2, 13], fov: 50, near: 0.01, far: 150 }}
        dpr={[1, dprCap]}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
        style={{ background: 'transparent' }}
        onCreated={({ gl }) => {
          const canvas = gl.domElement;

          const onLost = (e) => {
            e.preventDefault();
            lostAt.current = Date.now();
            clearTimeout(rebootTimer.current);
            rebootTimer.current = setTimeout(() => {
              if (lostAt.current && Date.now() - lostAt.current >= 1500) {
                setCtxKey((k) => k + 1);
                lostAt.current = null;
              }
            }, 1600);
          };

          const onRestored = () => {
            lostAt.current = null;
            clearTimeout(rebootTimer.current);
          };

          canvas.addEventListener('webglcontextlost', onLost);
          canvas.addEventListener('webglcontextrestored', onRestored);
        }}
      >
        <SceneContent />
        <PerformanceAutoTune onDprCap={setDprCap} />
        <CameraSystem />
      </Canvas>
    </div>
  );
}
