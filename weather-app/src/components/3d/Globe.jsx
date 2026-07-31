import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useWeatherStore } from '../../store/weatherStore';
import { useInverseGeocode } from '../../hooks/useWeather';

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
   orbits the globe to match the true day/night terminator. */
export const globeFocus = { active: false, pinY: 0 };
export const sunBus = {
  dir: new THREE.Vector3(0.5, 0.6, 0.6),
  center: new THREE.Vector3(0, -1.3, -3.5),
};

/* Real-time global cloud cover from NASA GIBS (MODIS) — equirect 1024×512.
   Falls back to the bundled cloud map when the network/NASA is unavailable. */
let liveCloudPromise = null;
function loadLiveClouds() {
  if (!liveCloudPromise) {
    const date = new Date().toISOString().slice(0, 10);
    const url =
      'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms' +
      `?REQUEST=GetMap&LAYERS=MODIS_Terra_Cloud_Fraction&DATE=${date}&CRS=EPSG:4326` +
      '&BBOX=-180,-90,180,90&WIDTH=1024&HEIGHT=512&FORMAT=image/png&TRANSPARENT=FALSE';
    liveCloudPromise = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error('GIBS failed');
        return r.blob();
      })
      .then((blob) => {
        const img = new Image();
        img.src = URL.createObjectURL(blob);
        return new Promise((resolve, reject) => {
          img.onload = () => resolve(img);
          img.onerror = reject;
        });
      })
      .catch((e) => {
        liveCloudPromise = null;
        throw e;
      });
  }
  return liveCloudPromise;
}

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

  if (liveImage) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgba(255,255,255,${0.55 + cloudiness * 0.45})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
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

  useFrame(({ clock, camera }, delta) => {
    const t = clock.elapsedTime;

    /* The pin shrinks as the camera zooms into the surface — at full zoom
       it is a small precise marker instead of covering the whole city. */
    const target = THREE.MathUtils.clamp((camera.position.z - 1.6) / 8.9, 0.22, 1);
    zoomScale.current += (target - zoomScale.current) * Math.min(1, delta * 4);
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

  useFrame(({ clock, camera }, delta) => {
    const t = clock.elapsedTime;

    /* Same zoom-shrink as the main pin, so pins stay proportional while
       flying in — but the invisible hit area stays full size for clicks. */
    const target = THREE.MathUtils.clamp((camera.position.z - 1.6) / 8.9, 0.22, 1);
    zoomScale.current += (target - zoomScale.current) * Math.min(1, delta * 4);
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
      {/* Big invisible hit area — easy to click, stops the globe click handler */}
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
        <sphereGeometry args={[0.16, 16, 16]} />
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
  const loc = useWeatherStore((s) => s.location);
  const setLocation = useWeatherStore((s) => s.setLocation);
  const weatherType = useWeatherStore((s) => s.weatherType);
  const isDaytime = useWeatherStore((s) => s.isDaytime);
  const lat = loc?.lat ?? 51.5074;
  const lon = loc?.lon ?? -0.1278;

  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(null);
  const [geoFor, setGeoFor] = useState(null);
  const [focused, setFocused] = useState(false);
  const [liveClouds, setLiveClouds] = useState(null);
  const dragState = useRef({ x: 0, rotY: 0, moved: 0 });
  const hovering = useRef(false);
  const targetRot = useRef(null);
  const camTarget = useRef({ z: 10.5, y: 0 });
  const lastClickAt = useRef(0);
  const clickedRef = useRef(false);
  const sunBase = useRef(new THREE.Vector3(0.5, 0.6, 0.6));
  const darkness = useRef(isDaytime ? 0 : 1);

  /* Real-time global cloud cover (NASA MODIS cloud fraction) */
  useEffect(() => {
    let cancelled = false;
    loadLiveClouds()
      .then((img) => !cancelled && setLiveClouds(img))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  /* Solar subpoint — drives the day/night terminator on the globe */
  useEffect(() => {
    const compute = () => {
      if (loc?.lat == null || loc?.lon == null) return;
      const now = new Date();
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
  }, [loc?.lat, loc?.lon]);

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
      } else if (e.key === '+' || e.key === '=') {
        camTarget.current.z = THREE.MathUtils.clamp(camTarget.current.z - 0.6, 2.0, 11.5);
      } else if (e.key === '-' || e.key === '_') {
        camTarget.current.z = THREE.MathUtils.clamp(camTarget.current.z + 0.6, 2.0, 11.5);
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
          varying vec2 vUv;
          varying vec3 vWorldNormal;
          void main() {
            float facing = dot(normalize(vWorldNormal), sunDir);
            float night = smoothstep(0.12, -0.08, facing);
            vec4 tex = texture2D(map, vUv);
            gl_FragColor = vec4(tex.rgb * night * uDarkness, 1.0);
          }
        `,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [lightsMap]
  );

  const pinPosition = useMemo(() => latLonToVec3(lat, lon, 1.5), [lat, lon]);
  const labelTexture = useMemo(() => makeLabelTexture(loc?.name || ''), [loc?.name]);

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
     Map clicks keep the user's current zoom; searches always go to the deep view. */
  useEffect(() => {
    if (loc?.lat == null || loc?.lon == null) return;
    const dir = latLonToVec3(loc.lat, loc.lon, 1);
    targetRot.current = -Math.atan2(dir.x, dir.z);
    const pinY = 3.3 * Math.sin((loc.lat * Math.PI) / 180) - 1.3;
    camTarget.current = {
      z: clickedRef.current ? Math.min(camTarget.current.z, 2.5) : 2.5,
      y: pinY,
    };
    clickedRef.current = false;
    globeFocus.pinY = pinY;
    setFocused(true);
    globeFocus.active = true;
  }, [loc?.lat, loc?.lon]);

  const selectFromClick = useCallback((event) => {
    /* Throttle rapid click storms — each hit fires weather + forecast + AQI
       + reverse-geocode, and 4-6 concurrent clicks will 429 the APIs. */
    const now = performance.now();
    if (now - lastClickAt.current < 500) return;
    lastClickAt.current = now;
    clickedRef.current = true;

    const rect = gl.domElement.getBoundingClientRect();
    ndc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObject(rotateRef.current, false);
    if (hits.length === 0) return;

    const local = hits[0].point.clone();
    rotateRef.current.worldToLocal(local);
    const dir = local.normalize();

    const latDeg = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)) * 180 / Math.PI;
    /* atan2 spans (-180, 180]; subtracting 180 yields (-360, 0] — wrap it
       back into the valid [-180, 180] range or the APIs 400 (Bad Request). */
    let lonDeg = Math.atan2(dir.z, -dir.x) * 180 / Math.PI - 180;
    lonDeg = ((lonDeg + 540) % 360) - 180;

    const fallback = `${Math.abs(latDeg).toFixed(1)}°${latDeg >= 0 ? 'N' : 'S'}, ${Math.abs(lonDeg).toFixed(1)}°${lonDeg >= 0 ? 'E' : 'W'}`;
    setLocation({ name: fallback, lat: latDeg, lon: lonDeg });
    setPending({ lat: latDeg, lon: lonDeg });
    setGeoFor({ lat: latDeg, lon: lonDeg });
  }, [camera, gl, ndc, raycaster, setLocation]);

  /* Window-level drag listeners so rotation survives pointer leaving the globe.
     Attached once (not gated on `dragging`) so fast clicks never race the
     state re-render and get lost. */
  const pointerDown = useRef(false);
  const pinHitRef = useRef(false);
  useEffect(() => {
    const onMove = (e) => {
      if (!pointerDown.current) return;
      const dx = e.clientX - dragState.current.x;
      dragState.current.moved = Math.max(dragState.current.moved, Math.abs(dx));
      targetRot.current = null;
      if (rotateRef.current) {
        rotateRef.current.rotation.y = dragState.current.rotY + dx * 0.006;
      }
    };

    const onUp = (e) => {
      if (!pointerDown.current) return;
      pointerDown.current = false;
      setDragging(false);
      const pinHit = pinHitRef.current;
      pinHitRef.current = false;
      if (!pinHit && dragState.current.moved < 6) selectFromClick(e);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [selectFromClick]);

  /* Mouse wheel: zoom the camera in/out (works whether focused or free-spinning) */
  useEffect(() => {
    const el = gl.domElement;
    const onWheel = (e) => {
      e.preventDefault();
      camTarget.current.z = THREE.MathUtils.clamp(
        camTarget.current.z + e.deltaY * 0.0075,
        2.0,
        11.5
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
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
    const manual = dragging || hovering.current;
    const zoom = reducedMotion ? 1 : Math.min(1, delta * 3);

    camera.position.z += (camTarget.current.z - camera.position.z) * zoom;
    camera.position.y += ((focused ? camTarget.current.y : 0) - camera.position.y) * zoom;

    if (targetRot.current != null && rotateRef.current) {
      const diff = wrapAngle(targetRot.current - rotateRef.current.rotation.y);
      rotateRef.current.rotation.y += diff * Math.min(1, delta * 3);
      if (Math.abs(diff) < 0.004) {
        rotateRef.current.rotation.y = targetRot.current;
        targetRot.current = null;
      }
    } else if (!manual && !focused && !reducedMotion && rotateRef.current) {
      /* Full 360° drift while exploring — the earth keeps turning and the
         day/night terminator sweeps across it. Frozen while focused so the
         world stays put under the cursor (clicks stay accurate). */
      rotateRef.current.rotation.y += delta * 0.045;
    }

    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * 0.07;
    }
    if (lightsRef.current) {
      /* The lights overlay must stay glued to the surface — it has its own
         material matrix but we keep its rotation locked to the earth's. */
      lightsRef.current.rotation.y = rotateRef.current?.rotation.y ?? 0;
    }
    if (lightsMaterial) {
      const rot = rotateRef.current?.rotation.y ?? 0;
      lightsMaterial.uniforms.sunDir.value
        .copy(sunBase.current)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      const target = isDaytime ? 0 : 1;
      darkness.current += (target - darkness.current) * Math.min(1, delta * 2);
      lightsMaterial.uniforms.uDarkness.value = darkness.current;
      /* Publish the world-space sun direction so Lighting() can orbit the
         actual light to the true sub-solar point (rotation reflects day/night). */
      sunBus.dir
        .copy(sunBase.current)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), rot)
        .normalize();
    }
    if (atmRef.current) {
      const pulse = 1 + Math.sin(clock.elapsedTime * 0.5) * 0.01;
      atmRef.current.scale.setScalar(pulse);
    }
    if (matRef.current) {
      matRef.current.emissiveIntensity = isDaytime ? 0.28 : 0.06;
    }
    if (labelRef.current) {
      /* The name chip shrinks with the pin as the camera zooms in. */
      const target = THREE.MathUtils.clamp((camera.position.z - 1.6) / 8.9, 0.22, 1);
      labelScale.current += (target - labelScale.current) * Math.min(1, delta * 4);
      const s = labelScale.current;
      labelRef.current.scale.set(1.1 * s, 0.275 * s, 1);
    }
    if (groupRef.current) {
      groupRef.current.position.y = -2 + Math.sin(clock.elapsedTime * 0.15) * 0.08;
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
          dragState.current = { x: e.clientX, rotY: rotateRef.current.rotation.y, moved: 0 };
          setDragging(true);
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
          map={atmosMap}
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

        {travelPins.map((d) => (
          <TravelPin
            key={`${d.lat.toFixed(3)},${d.lon.toFixed(3)}`}
            position={d.pos}
            onPinDown={() => {
              pinHitRef.current = true;
            }}
            onFly={() => setLocation({ name: d.name, lat: d.lat, lon: d.lon })}
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
          opacity={0.32}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}