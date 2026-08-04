import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { loadLayerEquirect } from '../../lib/owmTiles';

/* Weather raster overlay glued to the globe's surface. Re-projects the
   OWM Web-Mercator tiles to equirectangular once, then sits inside the
   rotating earth mesh so it tracks the terrain. Falls back silently. */
export default function MapLayer({ layer, radius, opacity, alphaMode = 'keep' }) {
  const [image, setImage] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setImage(null);
    setFailed(false);
    loadLayerEquirect(layer, alphaMode)
      .then((canvas) => !cancelled && setImage(canvas))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [layer, alphaMode]);

  const texture = useMemo(() => {
    if (!image) return null;
    const tex = new THREE.CanvasTexture(image);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, [image]);

  if (!texture || failed) return null;

  return (
    <mesh>
      <sphereGeometry args={[radius, 96, 96]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
