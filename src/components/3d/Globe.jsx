import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useWeatherStore } from '../../store/weatherStore';
import { useInverseGeocode } from '../../hooks/useWeather';
import { loadLiveClouds } from '../../lib/owmTiles';
import MapLayer from './MapLayer';
import DetailLayer from './DetailLayer';

const cloudinessByType = {
  clear: 0.08,
  'partly-cloudy': 0.35,
  cloudy: 0.75,
  rain: 0.9,
  drizzle: 0.85,
  thunderstorm: 0.95,
  snow: 0.55,
  mist: 0.45,
};

/* Shared camera/sun state: CameraSystem (WeatherScene) reads these each frame
   so the ambient drift doesn't fight the focused zoom, and so the sun light
   orbits the globe to match the true day/night terminator. The focused camera
   ray-aims at the pin's actual world position, so it stays dead-centre even
   while the globe is tumbled. */
export const globeFocus = {
  active: false,
  pinX: 0,
  pinY: 0,
  pinZ: 0,
  cx: 0,
  cy: -1.3,
  cz: -3.5,
  dist: 14,
};
export const sunBus = {
  dir: new THREE.Vector3(0.5, 0.6, 0.6),
  center: new THREE.Vector3(0, -1.3, -3.5),
};

/* Scroll-wheel zoom anchor: while the user wheels, the camera eases toward
   this world position instead of the idle drift target, so the zoom stays
   pointed at the place under the cursor (Google-Maps style). Reset on drag,
   fly or map-mode toggle. */
export const camAnchor = { active: false, x: 0, y: 0, z: 0 };

/* Deep-zoom detail state, published every frame by the Globe: `g` = camera
   distance to the surface (world units), lat/lon = the point the camera is
   aimed at (cursor anchor while wheeling, pin while focused, else the
   screen centre). DetailLayer reads it and fetches sharper tiles. */
export const detailBus = { g: 99, lat: 0, lon: 0, panning: false };

/* Zoom-shrink factor for pins + labels — written each frame from the camera
   distance, read by PinMarker/TravelPin so they shrink while flying in.
   Squared falloff: the closer the camera gets, the smaller the text/pins
   become (linear scaling would keep them looking the same size on screen). */
const pinZoom = { value: 1 };

/* Scratch vector reused by the detailBus publish below (avoid GC churn). */
const tmpDetail = new THREE.Vector3();

/* 4096×2048 earth maps (three-globe demo assets, CORS-open) — loaded at
   runtime on top of the bundled 2048 textures when the network allows. */
const HI_RES_TEXTURES = [
  { key: 'map', url: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg', srgb: true },
  { key: 'normal', url: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png', srgb: false },
  { key: 'specular', url: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-water.png', srgb: true },
  { key: 'lights', url: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg', srgb: true },
];

function loadHiResImage(url) {
  return fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error('hi-res texture failed');
      return r.blob();
    })
    .then(
      (blob) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = URL.createObjectURL(blob);
        })
    );
}

/* Google-Earth-style map + night themes, derived from the satellite imagery:
   - map:   flat-style terrain colours (soft water blues, tan/green land)
   - night: dimmed albedo — the city-lights overlay carries the scene */
/* Country border geometry for the "Countries" theme — Natural Earth admin-0
   boundaries (johan's world.geo.json), fetched once and cached. */
let countriesPromise = null;
function loadCountries() {
  if (!countriesPromise) {
    countriesPromise = fetch(
      'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json'
    )
      .then((r) => {
        if (!r.ok) throw new Error(`countries fetch failed (${r.status})`);
        return r.json();
      })
      .catch((e) => {
        countriesPromise = null;
        throw e;
      });
  }
  return countriesPromise;
}

function buildThemeTextures(srcImage, lightsImage, countries) {
  const mk = (canvas) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    return tex;
  };

  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = srcImage.width;
  mapCanvas.height = srcImage.height;
  const mapCtx = mapCanvas.getContext('2d', { willReadFrequently: true });
  mapCtx.drawImage(srcImage, 0, 0);
  const mapData = mapCtx.getImageData(0, 0, mapCanvas.width, mapCanvas.height);
  const d = mapData.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const isWater = b > r + 14 && b > g + 10 && lum < 150;
    if (isWater) {
      d[i] = 60 + lum * 0.22;
      d[i + 1] = 108 + lum * 0.18;
      d[i + 2] = 170 + lum * 0.1;
    } else {
      const t = Math.min(1, Math.max(0, (lum - 30) / 190));
      d[i] = 138 + (216 - 138) * t;
      d[i + 1] = 156 + (205 - 156) * t;
      d[i + 2] = 128 + (180 - 128) * t;
    }
  }
  mapCtx.putImageData(mapData, 0, 0);

  /* Night: Black-Marble style — near-black ocean and land, with the real
     city-lights map baked in (self-lit via the emissive map, so it reads
     even under the dim night lighting). */
  const nightCanvas = document.createElement('canvas');
  nightCanvas.width = srcImage.width;
  nightCanvas.height = srcImage.height;
  const nightCtx = nightCanvas.getContext('2d', { willReadFrequently: true });
  nightCtx.drawImage(srcImage, 0, 0);
  const nightData = nightCtx.getImageData(0, 0, nightCanvas.width, nightCanvas.height);
  const nd = nightData.data;
  for (let i = 0; i < nd.length; i += 4) {
    const lum = 0.299 * nd[i] + 0.587 * nd[i + 1] + 0.114 * nd[i + 2];
    const isWater = nd[i + 2] > nd[i] + 14 && nd[i + 2] > nd[i + 1] + 10 && lum < 150;
    if (isWater) {
      nd[i] = 4;
      nd[i + 1] = 8;
      nd[i + 2] = 18;
    } else {
      const v = 6 + lum * 0.05;
      nd[i] = v;
      nd[i + 1] = v + 2;
      nd[i + 2] = v + 6;
    }
  }
  nightCtx.putImageData(nightData, 0, 0);
  if (lightsImage) {
    nightCtx.globalCompositeOperation = 'lighter';
    nightCtx.drawImage(lightsImage, 0, 0, nightCanvas.width, nightCanvas.height);
  }

  /* Countries: soft relief base + political borders from the GeoJSON. */
  const countryCanvas = document.createElement('canvas');
  countryCanvas.width = srcImage.width;
  countryCanvas.height = srcImage.height;
  const countryCtx = countryCanvas.getContext('2d', { willReadFrequently: true });
  countryCtx.drawImage(srcImage, 0, 0);
  const countryData = countryCtx.getImageData(0, 0, countryCanvas.width, countryCanvas.height);
  const cd = countryData.data;
  for (let i = 0; i < cd.length; i += 4) {
    const r = cd[i];
    const g = cd[i + 1];
    const b = cd[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const isWater = b > r + 14 && b > g + 10 && lum < 150;
    if (isWater) {
      cd[i] = 22;
      cd[i + 1] = 42;
      cd[i + 2] = 64;
    } else {
      /* Sandy paper-tone with subtle relief shading from the imagery. */
      const t = Math.min(1, Math.max(0, (lum - 30) / 190));
      const v = 196 - t * 26;
      cd[i] = v + 16;
      cd[i + 1] = v + 12;
      cd[i + 2] = v - 14;
    }
  }
  countryCtx.putImageData(countryData, 0, 0);
  if (countries) {
    const W = countryCanvas.width;
    const H = countryCanvas.height;
    const trace = (rings) => {
      countryCtx.beginPath();
      rings.forEach((ring) => {
        ring.forEach(([lon, lat], i) => {
          const x = ((lon + 180) / 360) * W;
          const y = ((90 - lat) / 180) * H;
          if (i === 0) countryCtx.moveTo(x, y);
          else countryCtx.lineTo(x, y);
        });
        countryCtx.closePath();
      });
      countryCtx.stroke();
    };
    countryCtx.lineWidth = Math.max(1, W / 2600);
    countryCtx.strokeStyle = 'rgba(52, 60, 78, 0.55)';
    countryCtx.lineJoin = 'round';
    for (const feat of countries.features || []) {
      const geo = feat?.geometry;
      if (!geo) continue;
      if (geo.type === 'Polygon') trace(geo.coordinates);
      else if (geo.type === 'MultiPolygon') geo.coordinates.forEach(trace);
    }
  }

  return { map: mk(mapCanvas), night: mk(nightCanvas), country: mk(countryCanvas) };
}

/* Real-time global cloud cover — OWM cloud tiles (CORS-enabled), fetched
   in lib/owmTiles.js and re-projected to equirect. Falls back to the
   bundled cloud map when the network/API is unavailable. */
function makeCloudTexture(cloudsImage, weatherType, liveImage) {
  const cloudiness = cloudinessByType[weatherType] ?? 0.3;
  const src = liveImage || cloudsImage;
  const canvas = document.createElement('canvas');
  canvas.width = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = liveImage ? 1 : Math.min(1, cloudiness * 1.15);
  ctx.drawImage(src, 0, 0);
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  return texture;
}

function latLonToVec3(lat, lon, radius) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function wrapAngle(a) {
  return ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
}

function PinMarker({ position }) {
  const ringRef = useRef();
  const glowRef = useRef();
  const scaleRef = useRef();
  const burstRef = useRef(0);
  const zoomScale = useRef(1);

  const quat = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), position.clone().normalize()),
    [position]
  );

  useEffect(() => {
    burstRef.current = 1;
  }, [position]);

  useFrame((_state, delta) => {
    const t = _state.clock.elapsedTime;

    /* The pin shrinks as the camera zooms into the surface — at full zoom
       it is a small precise marker instead of covering the whole city. */
    zoomScale.current += (pinZoom.value - zoomScale.current) * Math.min(1, delta * 4);
    if (scaleRef.current) scaleRef.current.scale.setScalar(zoomScale.current);

    if (ringRef.current) {
      const s = 1 + Math.sin(t * 2.2) * 0.35;
      ringRef.current.scale.setScalar(s);
      ringRef.current.material.opacity = 0.55 - Math.sin(t * 2.2) * 0.25;
    }
    if (glowRef.current) {
      glowRef.current.material.opacity = 0.1 + Math.sin(t * 3) * 0.05;
    }
    if (burstRef.current > 0 && ringRef.current) {
      burstRef.current -= delta * 1.5;
      const e = Math.max(0, burstRef.current);
      ringRef.current.scale.setScalar(1 + (1 - e) * 2.4);
      ringRef.current.material.opacity = 0.75 * e;
    }
  });

  return (
    <group position={position} quaternion={quat}>
      <group ref={scaleRef}>
        <mesh ref={glowRef} position={[0, 0, 0.02]}>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshBasicMaterial color="#ff5577" transparent opacity={0.15} depthWrite={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 0, 0.005]} rotation={[0, 0, 0]}>
          <ringGeometry args={[0.07, 0.095, 32]} />
          <meshBasicMaterial color="#ff5577" transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

function TravelPin({ position, onPinDown, onFly }) {
  const ringRef = useRef();
  const visualRef = useRef();
  const zoomScale = useRef(1);

  useFrame((_state, delta) => {
    const t = _state.clock.elapsedTime;

    /* Same zoom-shrink as the main pin, so pins stay proportional while
       flying in — but the invisible hit area stays full size for clicks. */
    zoomScale.current += (pinZoom.value - zoomScale.current) * Math.min(1, delta * 4);
    if (visualRef.current) visualRef.current.scale.setScalar(zoomScale.current);

    if (ringRef.current) {
      const s = 1 + Math.sin(t * 2.5) * 0.22;
      ringRef.current.scale.setScalar(s);
      ringRef.current.material.opacity = 0.32 - Math.sin(t * 2.5) * 0.12;
    }
  });

  return (
    <group position={position}>
      <group ref={visualRef}>
        {/* Pulse halo */}
        <mesh ref={ringRef} position={[0, 0, 0.02]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshBasicMaterial color="#39d9ff" transparent opacity={0.3} depthWrite={false} />
        </mesh>
        {/* Visible pin */}
        <mesh>
          <sphereGeometry args={[0.045, 16, 16]} />
          <meshBasicMaterial color="#39d9ff" />
        </mesh>
      </group>
      {/* Invisible hit area — generous but only around the pin itself, so
          clicks on nearby places still select the place, not the pin */}
      <mesh
        onPointerDown={(e) => {
          e.stopPropagation();
          onPinDown();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onFly();
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function makeLabelTexture(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  const text = name.length > 34 ? name.slice(0, 33) + '…' : name;
  ctx.font = '600 44px -apple-system, system-ui, sans-serif';
  const textW = ctx.measureText(text).width;
  const padX = 36;
  const w = Math.min(480, textW + padX * 2);
  const x0 = (512 - w) / 2;

  ctx.beginPath();
  ctx.roundRect(x0, 12, w, 96, 48);
  ctx.fillStyle = 'rgba(8, 12, 26, 0.72)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export default function Globe() {
  const groupRef = useRef();
  const rotateRef = useRef();
  const cloudsRef = useRef();
  const atmRef = useRef();
  const matRef = useRef();
  const lightsRef = useRef();
  const labelRef = useRef();
  const labelScale = useRef(1);
  const tmpQuat = useRef(new THREE.Quaternion());
  const pinWorld = useRef(new THREE.Vector3());
  const loc = useWeatherStore((s) => s.location);
  const setLocation = useWeatherStore((s) => s.setLocation);
  const weatherType = useWeatherStore((s) => s.weatherType);
  const isDaytime = useWeatherStore((s) => s.isDaytime);
  const earthTheme = useWeatherStore((s) => s.earthTheme);
  const weatherLayers = useWeatherStore((s) => s.weatherLayers);
  const lat = loc?.lat ?? 51.5074;
  const lon = loc?.lon ?? -0.1278;

  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  const [pending, setPending] = useState(null);
  const [geoFor, setGeoFor] = useState(null);
  const [focused, setFocused] = useState(false);
  const [liveClouds, setLiveClouds] = useState(null);
  const [hiRes, setHiRes] = useState(null);
  const [themeTextures, setThemeTextures] = useState(null);
  const dragState = useRef({ x: 0, rotY: 0, moved: 0 });
  const hovering = useRef(false);
  const multiTouchRef = useRef(false);
  const targetRot = useRef(null);
  const camTarget = useRef({ z: 10.5, y: 0 });
  const lastClickAt = useRef(0);
  const clickedRef = useRef(false);
  /* Where the user PRESSED (window coords) — the click is resolved against
     this, not the pointerup spot, so a slow press that drifts a couple of
     pixels still selects the place they intended. */
  const downClient = useRef({ x: 0, y: 0 });
  /* Freeze the camera + earth matrices at the moment the pointer goes DOWN.
     The click is resolved against these frozen matrices, not the live ones:
     between press and release the focused camera can keep flying (the press
     itself cancels the focus dive), so a slow click would otherwise land
     somewhere the user never pointed at. */
  const clickCam = useMemo(() => new THREE.PerspectiveCamera(60, 1, 0.1, 100), []);
  const clickEarthInv = useRef(new THREE.Matrix4());
  /* Last accepted surface selection (coords + time) — used to detect a true
     double-click so we can suppress it without dropping fast different-spot
     clicks (those are deliberate moves and must never fall through). */
  const lastSel = useRef(null);
  const sunBase = useRef(new THREE.Vector3(0.5, 0.6, 0.6));
  const darkness = useRef(isDaytime ? 0 : 1);

  /* Real-time global cloud cover — OWM cloud tiles. Gated by the "Clouds"
     map-layer toggle; when off, fall back to the bundled cloud map so the
     globe never looks bare. */
  const cloudsEnabled = weatherLayers.clouds;
  useEffect(() => {
    let cancelled = false;
    if (!cloudsEnabled) {
      setLiveClouds(null);
      return undefined;
    }
    loadLiveClouds()
      .then((img) => !cancelled && setLiveClouds(img))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cloudsEnabled]);

  /* 4096px earth maps on top of the bundled 2048s (silently falls back) */
  useEffect(() => {
    let cancelled = false;
    Promise.all(HI_RES_TEXTURES.map((t) => loadHiResImage(t.url)))
      .then((imgs) => {
        if (cancelled) return;
        const mk = (img, srgb) => {
          const tex = new THREE.CanvasTexture(img);
          if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 16;
          return tex;
        };
        setHiRes({
          map: mk(imgs[0], true),
          normal: mk(imgs[1], false),
          specular: mk(imgs[2], true),
          lights: mk(imgs[3], true),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  /* Solar subpoint — drives the day/night terminator on the globe.
     With time-travel active (simulatedAt set) the terminator follows the
     simulated clock instead of the real one. */
  const simulatedAt = useWeatherStore((s) => s.simulatedAt);
  useEffect(() => {
    const compute = () => {
      if (loc?.lat == null || loc?.lon == null) return;
      const now = new Date(simulatedAt ?? Date.now());
      const dayOfYear =
        Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
      const decl =
        (23.44 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81)) * Math.PI) / 180;
      const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
      const hourAngle = ((utcHours + loc.lon / 15 - 12) * 15 * Math.PI) / 180;
      const subLat = (decl * 180) / Math.PI;
      const subLon = loc.lon - (hourAngle * 180) / Math.PI;
      sunBase.current.copy(latLonToVec3(subLat, subLon, 1)).normalize();
    };
    compute();
    const t = setInterval(compute, 60 * 1000);
    return () => clearInterval(t);
  }, [loc?.lat, loc?.lon, simulatedAt]);

  /* Keyboard: arrows rotate the globe, +/- zooms (ignored while typing) */
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowLeft') {
        targetRot.current = (rotateRef.current?.rotation.y ?? 0) + 0.25;
        setFocused(false);
        globeFocus.active = false;
      } else if (e.key === 'ArrowRight') {
        targetRot.current = (rotateRef.current?.rotation.y ?? 0) - 0.25;
        setFocused(false);
        globeFocus.active = false;
      } else if (e.key === 'ArrowUp') {
        if (rotateRef.current) {
          rotateRef.current.rotation.x = THREE.MathUtils.clamp(
            rotateRef.current.rotation.x + 0.18,
            -1.35,
            1.35
          );
        }
        setFocused(false);
        globeFocus.active = false;
      } else if (e.key === 'ArrowDown') {
        if (rotateRef.current) {
          rotateRef.current.rotation.x = THREE.MathUtils.clamp(
            rotateRef.current.rotation.x - 0.18,
            -1.35,
            1.35
          );
        }
        setFocused(false);
        globeFocus.active = false;
      } else if (e.key === '+' || e.key === '=') {
        if (globeFocus.active) {
          globeFocus.dist = THREE.MathUtils.clamp(globeFocus.dist - 0.6, 3.35, 16);
        } else {
          camTarget.current.z = THREE.MathUtils.clamp(camTarget.current.z - 0.6, 0.35, 15);
        }
      } else if (e.key === '-' || e.key === '_') {
        if (globeFocus.active) {
          globeFocus.dist = THREE.MathUtils.clamp(globeFocus.dist + 0.6, 3.35, 16);
        } else {
          camTarget.current.z = THREE.MathUtils.clamp(camTarget.current.z + 0.6, 0.35, 15);
        }
      } else {
        return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const { data: geoResult, isLoading: geoLoading } = useInverseGeocode(pending?.lat, pending?.lon);

  const [atmosMap, normalMap, specularMap, cloudsImage, lightsMap] = useLoader(THREE.TextureLoader, [
    '/textures/earth_atmos_2048.jpg',
    '/textures/earth_normal_2048.jpg',
    '/textures/earth_specular_2048.jpg',
    '/textures/earth_clouds_1024.png',
    '/textures/earth_lights_2048.png',
  ]);

  useMemo(() => {
    atmosMap.colorSpace = THREE.SRGBColorSpace;
    atmosMap.anisotropy = 16;
    specularMap.anisotropy = 16;
    normalMap.anisotropy = 16;
    lightsMap.colorSpace = THREE.SRGBColorSpace;
    lightsMap.anisotropy = 16;
  }, [atmosMap, normalMap, specularMap, lightsMap]);

  /* Map / Night / Country theme textures — derived from whichever satellite
     map is active (4096 when available, otherwise the bundled 2048). The
     country borders fetch is best-effort; without it the country theme
     falls back to a clean relief map. */
  const themeSource = hiRes?.map || atmosMap;
  useEffect(() => {
    const img = themeSource?.image;
    if (!img || !img.width) return;
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        let countries = null;
        try {
          countries = await loadCountries();
        } catch {
          /* offline — country theme renders without borders */
        }
        if (cancelled) return;
        const lightsImg = (hiRes?.lights || lightsMap)?.image;
        const built = buildThemeTextures(img, lightsImg, countries);
        if (!cancelled) setThemeTextures(built);
      } catch {
        /* keep satellite if processing fails */
      }
    }, 80);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [themeSource, lightsMap, hiRes]);

  const cloudTexture = useMemo(
    () => makeCloudTexture(cloudsImage.image, weatherType, liveClouds),
    [cloudsImage, weatherType, liveClouds]
  );
  /* Day/night terminator: city lights only on the dark side */
  const lightsMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          map: { value: lightsMap },
          sunDir: { value: sunBase.current.clone() },
          uDarkness: { value: 0 },
          uForceNight: { value: 0 },
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vWorldNormal;
          void main() {
            vUv = uv;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D map;
          uniform vec3 sunDir;
          uniform float uDarkness;
          uniform float uForceNight;
          varying vec2 vUv;
          varying vec3 vWorldNormal;
          void main() {
            float facing = dot(normalize(vWorldNormal), sunDir);
            float night = mix(smoothstep(0.12, -0.08, facing), 1.0, uForceNight);
            vec4 tex = texture2D(map, vUv);
            gl_FragColor = vec4(tex.rgb * night * uDarkness, 1.0);
          }
        `,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [lightsMap]
  );

  /* Swap in the 4096px night map once it arrives */
  useEffect(() => {
    if (hiRes?.lights) lightsMaterial.uniforms.map.value = hiRes.lights;
  }, [hiRes, lightsMaterial]);

  const pinPosition = useMemo(() => latLonToVec3(lat, lon, 1.5), [lat, lon]);
  const labelTexture = useMemo(() => makeLabelTexture(loc?.name || ''), [loc?.name]);

  /* Theme → albedo map: satellite uses the photo maps; map/night/country use
     the derived variants (falling back to the photo map while they render).
     The night texture also glows via the emissive map (below). */
  const albedoMap =
    earthTheme === 'map'
      ? themeTextures?.map || hiRes?.map || atmosMap
      : earthTheme === 'night'
        ? themeTextures?.night || hiRes?.map || atmosMap
        : earthTheme === 'country'
          ? themeTextures?.country || hiRes?.map || atmosMap
          : hiRes?.map || atmosMap;

  /* The night texture is self-lit — city lights baked into the albedo must
     read under the (intentionally dim) night theme lighting. */
  useEffect(() => {
    const mat = matRef.current;
    if (!mat) return;
    const want = earthTheme === 'night' ? themeTextures?.night || null : null;
    if (mat.emissiveMap !== want) {
      mat.emissiveMap = want;
      mat.needsUpdate = true;
    }
  }, [earthTheme, themeTextures]);

  /* Clouds render as a subtle tint (they're weather data, not the map) —
     dense cloud tops only, so no white film washes the globe. */
  const cloudOpacity =
    earthTheme === 'night' ? 0.1 : earthTheme === 'map' || earthTheme === 'country' ? 0.15 : 0.2;
  const isNightTheme = earthTheme === 'night';

  /* Reverse-geocode the clicked point once resolved (race-proof: only applies to the coords it was fetched for) */
  useEffect(() => {
    if (geoResult?.[0] && pending && geoFor?.lat === pending.lat && geoFor?.lon === pending.lon) {
      const name = [geoResult[0].name, geoResult[0].country].filter(Boolean).join(', ');
      setLocation({ name, lat: pending.lat, lon: pending.lon });
      setPending(null);
    }
  }, [geoResult, pending, geoFor, setLocation]);

  /* Fallback: if the click landed somewhere with no geocode result (e.g. ocean),
     the weather response itself carries the nearest place name — use it. */
  const weather = useWeatherStore((s) => s.weather);

  /* Last resort: name oceans (OpenWeather has no place names at sea) */
  useEffect(() => {
    if (!pending || geoLoading || geoResult?.[0]) return;
    let cancelled = false;
    fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pending.lat}&longitude=${pending.lon}&localityLanguage=en`
    )
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !pending) return;
        const place = d.ocean || [d.locality, d.city, d.principalSubdivision, d.countryName].find(Boolean);
        if (place) {
          setLocation({ name: place, lat: pending.lat, lon: pending.lon });
          setPending(null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pending, geoLoading, geoResult, setLocation]);

  /* Once the weather for the clicked spot arrives, force-resolve the coords name
     with whatever place name we can derive (covers rate-limited geocoding). */
  const wxName = useMemo(() => {
    if (!weather || !loc?.name) return null;
    if (Math.abs(weather.coord.lat - loc.lat) > 0.05 || Math.abs(weather.coord.lon - loc.lon) > 0.05) return null;
    if (weather.name) return [weather.name, weather.sys?.country].filter(Boolean).join(', ');
    return null;
  }, [weather, loc]);
  useEffect(() => {
    if (!loc?.name || !/°[NS]/.test(loc.name)) return;
    if (wxName && wxName !== loc.name) {
      setLocation({ ...loc, name: wxName });
    }
  }, [wxName, loc, setLocation]);

  /* Rotate the globe so a newly selected location faces the camera, then zoom in on it.
     Searches always go to the deep view; map clicks keep the user's current zoom.
     On the initial load (no user interaction yet) the globe only aligns to the
     default city — no camera dive, so the world opens in the full-earth view. */
  const interacted = useWeatherStore((s) => s.interacted);
  useEffect(() => {
    if (loc?.lat == null || loc?.lon == null) return;
    camAnchor.active = false;
    const narrowMobile =
      typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
    const dir = latLonToVec3(loc.lat, loc.lon, 1);
    targetRot.current = -Math.atan2(dir.x, dir.z);
    if (!interacted) {
      clickedRef.current = false;
      /* Deep links on mobile open in the full-earth view (the rail covers
         the screen, a close-up would hide the map); on desktop they still
         fly down to the shared city. */
      if (narrowMobile) return;
    }
    camTarget.current = {
      z: clickedRef.current ? camTarget.current.z : 1.6,
      y: 0,
    };
    clickedRef.current = false;
    setFocused(true);
    camAnchor.active = false;
    globeFocus.active = true;
  }, [loc?.lat, loc?.lon, interacted]);

  /* Collapsing the rail on mobile = "show the map": drop any focus dive so
     the whole globe becomes visible again. Expanding leaves the view alone. */
  const detailsCollapsed = useWeatherStore((s) => s.detailsCollapsed);
  useEffect(() => {
    const narrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
    if (detailsCollapsed && narrow) {
      camAnchor.active = false;
      globeFocus.active = false;
      setFocused(false);
      camTarget.current = { z: 10.5, y: 0 };
    }
  }, [detailsCollapsed]);

  const selectFromClick = useCallback((event) => {
    /* Throttle only true double-clicks (same spot, ~400ms). Every OTHER
       click — including fast clicks on a different spot — is a deliberate
       move and must land exactly where the user pressed. */
    const now = performance.now();

    /* Resolve the hit against the PRESS position, not the release: while
       holding a slow click the pointer can wander a few pixels, and at
       surface zoom that drift is kilometres. */
    const p = downClient.current || { x: event.clientX, y: event.clientY };
    const rect = gl.domElement.getBoundingClientRect();
    ndc.set(
      ((p.x - rect.left) / rect.width) * 2 - 1,
      -((p.y - rect.top) / rect.height) * 2 + 1
    );
    /* The globe may be mid-rotation (drag or fly easing) — the click is
       resolved against the camera + earth matrices frozen at pointer-down,
       i.e. exactly what the user saw when they pressed, not the (possibly
       already-drifted) state at release. */
    raycaster.setFromCamera(ndc, clickCam);

    /* Intersect the press-time ray with the press-time earth sphere (radius
       1.5) analytically in the frozen local frame — intersectObject would
       use the CURRENT world matrix, which may still be tumbling. */
    const inv = clickEarthInv.current;
    const o = raycaster.ray.origin.clone().applyMatrix4(inv);
    const d = raycaster.ray.direction.clone().transformDirection(inv);
    const a = d.dot(d);
    const b = o.dot(d);
    const c = o.dot(o) - 1.5 * 1.5;
    const disc = b * b - a * c;
    if (a <= 0 || disc < 0) return;
    const t = (-b - Math.sqrt(disc)) / a;
    if (t < 0) return;
    const dir = o.addScaledVector(d, t).normalize();

    const latDeg = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)) * 180 / Math.PI;
    /* atan2 spans (-180, 180]; subtracting 180 yields (-360, 0] — wrap it
       back into the valid [-180, 180] range or the APIs 400 (Bad Request). */
    let lonDeg = Math.atan2(dir.z, -dir.x) * 180 / Math.PI - 180;
    lonDeg = ((lonDeg + 540) % 360) - 180;

    const doubleClickSame =
      lastSel.current &&
      now - lastClickAt.current < 400 &&
      Math.abs(latDeg - lastSel.current.lat) < 0.15 &&
      Math.abs(lonDeg - lastSel.current.lon) < 0.15;
    if (doubleClickSame) return;
    lastClickAt.current = now;
    lastSel.current = { lat: latDeg, lon: lonDeg };
    clickedRef.current = true;

    const fallback = `${Math.abs(latDeg).toFixed(1)}°${latDeg >= 0 ? 'N' : 'S'}, ${Math.abs(lonDeg).toFixed(1)}°${lonDeg >= 0 ? 'E' : 'W'}`;
    setLocation({ name: fallback, lat: latDeg, lon: lonDeg });
    setPending({ lat: latDeg, lon: lonDeg });
    setGeoFor({ lat: latDeg, lon: lonDeg });
  }, [gl, ndc, raycaster, clickCam, clickEarthInv, setLocation]);

  /* Window-level drag listeners so rotation survives pointer leaving the globe.
     Attached once (not gated on `dragging`) so fast clicks never race the
     state re-render and get lost. */
  const pointerDown = useRef(false);
  const pinHitRef = useRef(false);
  useEffect(() => {
    const onMove = (e) => {
      if (!pointerDown.current || multiTouchRef.current) return;
      const dx = e.clientX - dragState.current.x;
      const dy = e.clientY - dragState.current.y;
      dragState.current.moved = Math.max(dragState.current.moved, Math.abs(dx), Math.abs(dy));
      targetRot.current = null;
      if (rotateRef.current) {
        /* Drag = free 360° navigation: horizontal sweeps yaw around the
           pole, vertical sweeps pitch so you can tilt down to the poles. */
        rotateRef.current.rotation.y = dragState.current.rotY + dx * 0.006;
        rotateRef.current.rotation.x = THREE.MathUtils.clamp(
          dragState.current.rotX - dy * 0.005,
          -1.35,
          1.35
        );
      }
    };

    const onUp = (e) => {
      if (!pointerDown.current) return;
      pointerDown.current = false;
      const pinHit = pinHitRef.current;
      pinHitRef.current = false;
      if (!pinHit && dragState.current.moved < 10) selectFromClick(e);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [selectFromClick]);

  /* Mouse wheel: zoom the camera in/out — works BOTH in free mode (anchored
     on the point under the cursor) and while a city is focused (distances the
     pinned flight so the city stays dead-centre while zooming). */
  useEffect(() => {
    const el = gl.domElement;
    const onWheel = (e) => {
      e.preventDefault();

      /* Normalize delta units: mice report lines (deltaMode=1), trackpads
         report pixels (deltaMode=0). Without this some wheels barely move. */
      const step = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      const factor = 1 + step * 0.0016;

      if (focused) {
        /* Freshest distance instead of the (possible) stale closure value —
           read it at event time so rapid scrolls chain smoothly. dist is the
           camera's distance from the CENTRE along the pin line, so the floor
           keeps the camera just above the surface (radius 3.3) — deep enough
           to ride into the satellite detail bands. */
        const base = globeFocus.active ? globeFocus.dist : 4.5;
        globeFocus.dist = THREE.MathUtils.clamp(
          base * factor,
          3.35,
          16
        );
        camAnchor.active = false;
        return;
      }

      /* Free mode — zoom anchored on the point under the cursor: raycast the
         earth and move the camera along the camera→point line, scaled by the
         wheel delta. Hovering the edge of the globe now zooms INTO that edge
         instead of drifting off toward the centre. Misses (sky) fall back to
         zooming at the globe's centre, like the old wheel. */
      const rect = el.getBoundingClientRect();
      ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      camera.updateMatrixWorld();
      rotateRef.current?.updateWorldMatrix(true, false);
      raycaster.setFromCamera(ndc, camera);
      const hits = rotateRef.current
        ? raycaster.intersectObject(rotateRef.current, false)
        : [];

      const g = groupRef.current;
      const ax = g && hits.length ? hits[0].point.x : g ? g.position.x : 0;
      const ay = g && hits.length ? hits[0].point.y : g ? g.position.y : 0;
      const az = g && hits.length ? hits[0].point.z : g ? g.position.z : 0;

      const dx = camera.position.x - ax;
      const dy = camera.position.y - ay;
      const dz = camera.position.z - az;
      const dist = Math.hypot(dx, dy, dz) || 1;

      /* 2× closer than the 0.7 floor — the camera can ride down to ~0.35
         off the surface, doubling the on-screen detail yet again. The far
         end stretches out to 15 for a wider overview. */
      const newDist = THREE.MathUtils.clamp(dist * factor, 0.35, 15);
      const k = newDist / dist;

      camAnchor.active = true;
      camAnchor.x = ax + dx * k;
      camAnchor.y = ay + dy * k;
      camAnchor.z = az + dz * k;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, [gl, camera, ndc, raycaster, focused]);

  /* Touch pinch-zoom: two fingers squeeze to zoom the camera. While a pinch
     is active the single-finger drag rotation is suppressed, and lifting the
     second finger never registers as a map click. */
  useEffect(() => {
    const el = gl.domElement;
    el.style.touchAction = 'none';
    const pointers = new Map();
    let lastDist = 0;
    const onDown = (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      lastDist = 0;
    };
    const onUp = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) lastDist = 0;
      if (multiTouchRef.current && pointers.size < 2) {
        multiTouchRef.current = false;
        dragState.current.moved = 999;
      }
    };
    const onMove = (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size !== 2) return;
      multiTouchRef.current = true;
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastDist > 0) {
        const step = (lastDist - dist) * 0.018;
        if (globeFocus.active) {
          globeFocus.dist = THREE.MathUtils.clamp(globeFocus.dist + step, 3.35, 16);
        } else {
          camTarget.current.z = THREE.MathUtils.clamp(
            camTarget.current.z + step,
            0.35,
            15
          );
        }
      }
      lastDist = dist;
    };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [gl]);

  const travelDestinations = useWeatherStore((s) => s.travelDestinations);
  const travelPins = useMemo(
    () =>
      travelDestinations.map((d) => ({
        ...d,
        pos: latLonToVec3(d.lat, d.lon, 1.52),
      })),
    [travelDestinations]
  );

  useFrame(({ clock, camera }, delta) => {
    const zoom = reducedMotion ? 1 : Math.min(1, delta * 3);
    const rot = rotateRef.current;

    /* Unfocused: keep the camera at the user's zoom distance (wheel / +/-).
       While the cursor-anchored wheel zoom is active, ease toward the
       anchored position (off-axis on purpose) and stay in sync with the
       wheel/+/− zoom state. While focused the CameraSystem fully owns the
       camera and ray-aims it at the pin, so we only publish the state it
       needs below. */
    if (!focused) {
      if (camAnchor.active) {
        const k = Math.min(1, delta * 6);
        camera.position.x += (camAnchor.x - camera.position.x) * k;
        camera.position.y += (camAnchor.y - camera.position.y) * k;
        camera.position.z += (camAnchor.z - camera.position.z) * k;
        camTarget.current.z = camera.position.z;
      } else {
        camera.position.z += (camTarget.current.z - camera.position.z) * zoom;
      }
    }

    if (rot) {
      /* Navigation is user-driven: drag sweeps yaw (360°) and pitch. The
         user's tilt is kept while exploring; only a focused location
         settles the globe upright so the city lines up with the camera. */
      if (focused) {
        const k = Math.min(1, delta * 2);
        rot.rotation.x += (0 - rot.rotation.x) * k;
        rot.rotation.z += (0 - rot.rotation.z) * k;
      }
      rot.rotation.z += (0 - rot.rotation.z) * Math.min(1, delta * 2);

      if (targetRot.current != null) {
        const diff = wrapAngle(targetRot.current - rot.rotation.y);
        rot.rotation.y += diff * Math.min(1, delta * 3);
        if (Math.abs(diff) < 0.004) {
          rot.rotation.y = targetRot.current;
          targetRot.current = null;
        }
      }
    }

    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * 0.07;
    }
    if (lightsRef.current && rot) {
      /* The lights overlay must stay glued to the surface through the whole
         tumble — copy the full euler so its normals match the earth's. */
      lightsRef.current.rotation.copy(rot.rotation);
    }
    if (lightsMaterial && rot) {
      /* Rotate the sun direction by the FULL earth rotation (not just y) so
         the day/night terminator stays true during the 360° tumble. */
      tmpQuat.current.setFromEuler(rot.rotation);
      sunBus.dir.copy(sunBase.current).applyQuaternion(tmpQuat.current).normalize();
      lightsMaterial.uniforms.sunDir.value.copy(sunBus.dir);
      /* Night theme bakes its city lights into the albedo, so the overlay
         stays off there; otherwise it masks only the dark side. */
      const target = isNightTheme ? 0 : isDaytime ? 0 : 1;
      darkness.current += (target - darkness.current) * Math.min(1, delta * 2);
      lightsMaterial.uniforms.uDarkness.value = darkness.current;
      lightsMaterial.uniforms.uForceNight.value +=
        (0 - lightsMaterial.uniforms.uForceNight.value) * Math.min(1, delta * 3);
    }
    if (atmRef.current) {
      const pulse = 1 + Math.sin(clock.elapsedTime * 0.5) * 0.01;
      atmRef.current.scale.setScalar(pulse);
    }
    if (matRef.current) {
      matRef.current.emissiveIntensity = isNightTheme ? 0.95 : isDaytime ? 0.28 : 0.06;
    }

    /* Publish the camera-relative zoom for the pins + label chip, and — while
       focused — the pin's world position so CameraSystem can ray-aim at it. */
    if (groupRef.current) {
      const gp = groupRef.current.position;
      const dist = Math.hypot(
        camera.position.x - gp.x,
        camera.position.y - gp.y,
        camera.position.z - gp.z
      );
      /* Squared curve + low floor: the text keeps shrinking while zooming in
         instead of plateauing at 22%. */
      const zt = THREE.MathUtils.clamp((dist - 4.65) / (15 - 4.65), 0, 1);
      pinZoom.value = 0.1 + 0.9 * zt * zt;

      if (focused && rot) {
        globeFocus.cx = gp.x;
        globeFocus.cy = gp.y;
        globeFocus.cz = gp.z;
        /* The wheel / +/- / pinch own the focus distance while the city is
           pinned — do NOT re-derive it from camTarget every frame (that
           reverted the user's zoom instantly). The focus effect seeds it. */
        rot.updateWorldMatrix(true, false);
        /* World-space pin: local direction (rotation applied) scaled to the
           world radius. localToWorld was publishing unscaled coords, which
           put the camera inside the globe at deep zoom distances. */
        pinWorld.current
          .copy(pinPosition)
          .normalize()
          .applyQuaternion(rot.quaternion);
        const wr = 1.5 * (groupRef.current.scale?.x ?? 1);
        globeFocus.pinX = gp.x + pinWorld.current.x * wr;
        globeFocus.pinY = gp.y + pinWorld.current.y * wr;
        globeFocus.pinZ = gp.z + pinWorld.current.z * wr;
      }
    }
    if (labelRef.current) {
      /* The name chip shrinks with the pin as the camera zooms in. */
      labelScale.current += (pinZoom.value - labelScale.current) * Math.min(1, delta * 4);
      const s = labelScale.current;
      labelRef.current.scale.set(1.1 * s, 0.275 * s, 1);
    }
    if (rot && groupRef.current) {
      /* Publish deep-zoom detail state: gap from the surface + the point
         the camera is aimed at (cursor anchor while wheeling, pin while
         focused, else the screen centre) in earth-local coordinates. */
      tmpDetail.copy(camera.position);
      rot.worldToLocal(tmpDetail);
      detailBus.g = tmpDetail.length() - 1.5;
      detailBus.panning = pointerDown.current;
      if (detailBus.g < 2) {
        let wx = camera.position.x;
        let wy = camera.position.y;
        let wz = camera.position.z;
        if (camAnchor.active) {
          wx = camAnchor.x;
          wy = camAnchor.y;
          wz = camAnchor.z;
        } else if (globeFocus.active) {
          wx = globeFocus.pinX;
          wy = globeFocus.pinY;
          wz = globeFocus.pinZ;
        }
        tmpDetail.set(wx, wy, wz);
        rot.worldToLocal(tmpDetail);
        if (tmpDetail.lengthSq() > 1e-8) {
          tmpDetail.normalize();
          const phi = Math.acos(THREE.MathUtils.clamp(tmpDetail.y, -1, 1));
          detailBus.lat = 90 - (phi * 180) / Math.PI;
          detailBus.lon = ((Math.atan2(tmpDetail.z, -tmpDetail.x) * 180) / Math.PI - 180 + 540) % 360 - 180;
        }
      }
    }
    if (groupRef.current) {
      groupRef.current.position.y = -2 + Math.sin(clock.elapsedTime * 0.15) * 0.08;
      /* Keep the sun light + its target anchored to the globe's real
         floating centre, not the initial JSX position. */
      sunBus.center.copy(groupRef.current.position);
    }
  });

  return (
    <group ref={groupRef} position={[0, -1.3, -3.5]} scale={2.2}>
      {/* Atmosphere glow */}
      <mesh ref={atmRef}>
        <sphereGeometry args={[1.62, 48, 48]} />
        <meshBasicMaterial
          color={isDaytime ? '#4499ff' : '#3344aa'}
          transparent
          opacity={0.08}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Earth (rotates, drag + click to explore) */}
      <mesh
        ref={rotateRef}
        onPointerDown={(e) => {
          e.stopPropagation();
          pointerDown.current = true;
          camAnchor.active = false;
          downClient.current = { x: e.clientX, y: e.clientY };
          dragState.current = {
            x: e.clientX,
            y: e.clientY,
            rotY: rotateRef.current.rotation.y,
            rotX: rotateRef.current.rotation.x,
            moved: 0,
          };
          /* Freeze the exact view the user pressed on — the click resolves
             against this snapshot, immune to the focus dive / drift that
             starts right here. */
          clickCam.position.copy(camera.position);
          clickCam.quaternion.copy(camera.quaternion);
          clickCam.projectionMatrix.copy(camera.projectionMatrix);
          clickCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
          clickCam.updateMatrixWorld();
          rotateRef.current.updateWorldMatrix(true, false);
          clickEarthInv.current.copy(rotateRef.current.matrixWorld).invert();
          setFocused(false);
          globeFocus.active = false;
        }}
        onPointerOver={() => {
          hovering.current = true;
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          hovering.current = false;
          document.body.style.cursor = '';
        }}
      >
        <sphereGeometry args={[1.5, 128, 128]} />
        <meshPhongMaterial
          ref={matRef}
          map={albedoMap}
          specularMap={specularMap}
          specular={new THREE.Color('#777777')}
          shininess={10}
          normalMap={normalMap}
          normalScale={new THREE.Vector2(1, 1)}
          bumpMap={normalMap}
          bumpScale={0.025}
          emissive={new THREE.Color('#16263a')}
          emissiveIntensity={0.28}
        />

        {/* Pins & labels live INSIDE the rotating earth so they stay glued
            to the surface while the globe drifts. */}
        <PinMarker position={pinPosition} />

        {/* Weather overlays — re-projected OWM raster tiles riding the
            surface (clouds float on their own slower layer above). The
            alpha mode isolates the weather data from each tile basemap:
            temp = pastel gradient (saturation), rain = dark basemap
            (luma), wind = light basemap (brightness). */}
        {weatherLayers.temperature && (
          <MapLayer layer="temp_new" radius={1.507} opacity={earthTheme === 'night' ? 0.55 : 0.8} alphaMode="saturation" />
        )}
        {weatherLayers.precipitation && (
          <MapLayer layer="precipitation_new" radius={1.507} opacity={earthTheme === 'night' ? 0.5 : 0.78} alphaMode="luma" />
        )}
        {weatherLayers.wind && (
          <MapLayer layer="wind_new" radius={1.507} opacity={earthTheme === 'night' ? 0.5 : 0.62} alphaMode="brightness" />
        )}

        {/* Deep-zoom satellite detail — sharper tiles fade in while the
            camera rides close to the surface. */}
        <DetailLayer />

        {travelPins.map((d) => (
          <TravelPin
            key={`${d.lat.toFixed(3)},${d.lon.toFixed(3)}`}
            position={d.pos}
            onPinDown={() => {
              pinHitRef.current = true;
            }}
            onFly={() => {
              /* A drag that merely ends over a pin must not fly anywhere.
                 Only repeat clicks on the SAME pin are throttled — a fast
                 click on another pin is a deliberate move between places. */
              const now = performance.now();
              const samePin =
                lat != null && lon != null &&
                Math.abs(d.lat - lat) < 0.05 &&
                Math.abs(d.lon - lon) < 0.05;
              if (dragState.current.moved >= 8 || now - lastClickAt.current < (samePin ? 250 : 100)) return;
              lastClickAt.current = now;
              setLocation({ name: d.name, lat: d.lat, lon: d.lon });
            }}
          />
        ))}

        {/* Floating location name chip */}
        <sprite ref={labelRef} position={pinPosition.clone().multiplyScalar(1.2)} scale={[1.1, 0.275, 1]}>
          <spriteMaterial map={labelTexture} transparent depthWrite={false} />
        </sprite>
      </mesh>

      {/* Night side: city lights overlay — shader masks to the dark side only */}
      <mesh ref={lightsRef} material={lightsMaterial}>
        <sphereGeometry args={[1.503, 128, 128]} />
      </mesh>

      {/* Cloud layer (real cloud map, masked by weather) */}
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[1.525, 96, 96]} />
        <meshBasicMaterial
          map={cloudTexture}
          transparent
          opacity={cloudOpacity}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}