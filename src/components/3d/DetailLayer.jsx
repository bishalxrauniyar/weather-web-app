import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { detailBus } from './Globe';
import { loadDetailPatch, zoomForGap, gridFor, visibleSpanDeg } from '../../lib/detailTiles';
import { useWeatherStore } from '../../store/weatherStore';

/* How many zoom-band patches to keep alive. Each deeper patch is smaller than
   the one before it, so a small stack keeps the WHOLE screen covered by
   satellite imagery at every distance — older (blurrier) patches stay visible
   beneath newer (crisper) ones instead of fading to the blurry base texture.
   Stack order = oldest → newest; newest is drawn last into the mosaic. */
const MAX_LAYERS = 4;

/* Satellite detail patches riding just above the base earth. While the camera
   is deep it fetches Esri World Imagery tiles around the current view point
   at a zoom derived from camera distance, re-projects each to an equirect
   patch and composites the alive stack into one mosaic canvas that is UV-
   positioned on a slightly-raised sphere. Outside the deep zone the material
   just fades out and nothing is fetched. */
export default function DetailLayer() {
  const isDaytime = useWeatherStore((s) => s.isDaytime);
  const [texture, setTexture] = useState(null);
  const matRef = useRef();
  const fadeAlphaRef = useRef(0);
  const lastKey = useRef('');
  const lastFetch = useRef(0);
  const inFlightRef = useRef(false);
  const stackRef = useRef([]);
  const mosaicRef = useRef(null);
  const genRef = useRef(0);

  /* Required attribution for the Esri imagery source. */
  useEffect(() => {
    const el = document.createElement('div');
    el.textContent = 'Imagery © Esri';
    el.style.cssText =
      'position:fixed;right:10px;bottom:8px;font:10px/1.4 system-ui;color:rgba(255,255,255,.5);z-index:60;pointer-events:none;user-select:none';
    document.body.appendChild(el);
    return () => el.remove();
  }, []);

  useEffect(
    () => () => {
      if (mosaicRef.current?.texture) mosaicRef.current.texture.dispose();
    },
    []
  );

  /* Composite the alive patch stack into a fresh mosaic canvas centred on the
     aim point, sized so the deepest layer keeps its native sharpness. Returns
     the CanvasTexture (UV window = mosaic bounds) or null when the stack is
     empty. */
  const rebuildMosaic = (winLat, winLon, g) => {
    const stack = stackRef.current;
    if (!stack.length) return null;

    const winDeg = Math.min(135, Math.max(45, visibleSpanDeg(g) * 1.1));
    const lonSpan = winDeg;
    const latSpan = Math.min(60, winDeg / 2);
    const lonLeft = winLon - lonSpan / 2;
    const latTop = Math.min(84, winLat + latSpan / 2);
    const latBot = Math.max(-84, winLat - latSpan / 2);

    const pxPerDeg = (Math.pow(2, zoomForGap(g)) * 256) / 360;
    const w = Math.min(4096, Math.max(1024, Math.round(lonSpan * pxPerDeg)));
    const h = Math.min(2048, Math.max(512, Math.round(latSpan * pxPerDeg)));

    let m = mosaicRef.current;
    if (!m) {
      const canvas = document.createElement('canvas');
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      m = mosaicRef.current = { canvas, ctx: canvas.getContext('2d'), texture: tex };
    }
    if (m.canvas.width !== w || m.canvas.height !== h) {
      m.canvas.width = w;
      m.canvas.height = h;
    }
    const ctx = m.ctx;
    ctx.clearRect(0, 0, w, h);
    for (const L of stack) {
      const x = ((L.lonLeft - lonLeft) / lonSpan) * w;
      const y = ((latTop - L.latTop) / (latTop - latBot)) * h;
      const pw = ((L.lonRight - L.lonLeft) / lonSpan) * w;
      const ph = ((L.latTop - L.latBot) / (latTop - latBot)) * h;
      ctx.drawImage(L.canvas, x, y, pw, ph);
    }

    const tex = m.texture;
    /* Map the mosaic onto its lat/lon window on the sphere's UVs. */
    const uMin = (lonLeft + 180) / 360;
    const uSpan = lonSpan / 360;
    const vMin = (latBot + 90) / 180;
    const vSpan = (latTop - latBot) / 180;
    tex.repeat.set(1 / uSpan, 1 / vSpan);
    tex.offset.set(-uMin / uSpan, -vMin / vSpan);
    tex.needsUpdate = true;
    return tex;
  };

  useFrame((_, delta) => {
    const b = detailBus;
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* Fade the overlay out when zoomed out, while panning, and while the
       first patch is still loading. */
    if (matRef.current) {
      const targetAlpha = texture && b.g <= 1.45 && !b.panning ? (isDaytime ? 0.96 : 0.35) : 0;
      const fadeSpeed = reduced ? 1 : Math.min(1, delta * 5);
      fadeAlphaRef.current += (targetAlpha - fadeAlphaRef.current) * fadeSpeed;
      matRef.current.opacity = fadeAlphaRef.current;
    }

    /* Panning drags the aim point far from the stack's coverage — drop the
       stack so the next fetch restarts on the new spot. Bumping the fetch
       generation also discards any in-flight patch from the pre-pan
       position (but NOT from band-crossings — those complete and stack). */
    if (b.panning && stackRef.current.length) {
      stackRef.current = [];
      if (mosaicRef.current?.texture) mosaicRef.current.texture.dispose();
      mosaicRef.current = null;
      genRef.current++;
    }
    if (b.g > 1.45 || b.panning) return;

    const z = zoomForGap(b.g);
    /* Snap the centre to 0.25° cells at deep zoom (0.5° above) so slow pans
       reuse cached tiles. */
    const snap = z >= 8 ? 0.25 : 0.5;
    const lat = Math.round(b.lat / snap) * snap;
    const lon = ((Math.round(b.lon / snap) * snap + 540) % 360) - 180;
    const key = `${z}|${lat}|${lon}`;
    if (key === lastKey.current) return;
    if (inFlightRef.current) return;

    const now = performance.now();
    if (now - lastFetch.current < 250) return;
    lastFetch.current = now;
    lastKey.current = key;

    const { gridX, gridY } = gridFor(z, b.g);
    const gen = genRef.current;
    inFlightRef.current = true;
    loadDetailPatch({ lat, lon, z, gridX, gridY })
      .then((patch) => {
        if (gen !== genRef.current) return;
        const stack = stackRef.current;
        patch.z = z;
        stack.push(patch);
        stack.sort((a, b) => a.z - b.z);
        if (stack.length > MAX_LAYERS) {
          /* Drop the lowest layer fully covered by a sharper one; if none
             qualifies (view moved), drop the oldest anyway. */
          const top = stack[stack.length - 1];
          const dropIdx = stack.findIndex(
            (L) =>
              L.lonLeft >= top.lonLeft - 1e-9 &&
              L.lonRight <= top.lonRight + 1e-9 &&
              L.latTop <= top.latTop + 1e-9 &&
              L.latBot >= top.latBot - 1e-9
          );
          stack.splice(dropIdx === -1 ? 0 : dropIdx, 1);
        }

        const tex = rebuildMosaic(lat, lon, b.g);
        if (tex) {
          setTexture(tex);
        }
      })
      .catch(() => {
        /* Tile fetch failed — keep whatever mosaic we already had. */
        lastKey.current = '';
      })
      .finally(() => {
        inFlightRef.current = false;
      });
  });

  return (
    <mesh visible={!!texture} raycast={() => null}>
      <sphereGeometry args={[1.5075, 96, 96]} />
      <meshBasicMaterial
        ref={matRef}
        map={texture}
        transparent
        depthWrite={false}
        toneMapped={false}
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </mesh>
  );
}
