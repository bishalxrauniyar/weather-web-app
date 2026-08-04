/* OpenWeatherMap map tiles — CORS-enabled raster overlays used for the
   live cloud cover and the temperature / precipitation / wind layers.
   Tiles are Web-Mercator; we compose them into one canvas and re-project
   to equirectangular so the globe's UV mapping samples them correctly. */

const API_KEY = import.meta.env.VITE_OPENWEATHER_KEY || '';
const TILE_URL = (layer, z, x, y) =>
  `https://tile.openweathermap.org/map/${layer}/${z}/${x}/${y}.png?appid=${API_KEY}`;

/* Tile zoom: 3 = 2048×2048 mercator (64 tiles) → 2048×1024 equirect.
   Higher zooms would need 256 tiles/layer and push into API rate limits;
   this matches the bundled 2048px earth textures so zoomed-in views
   don't blur before the base map does. */
const ZOOM = 3;
const SIZE = 256 * Math.pow(2, ZOOM); /* 2048 */

const tileCache = new Map();

function fetchTile(layer, x, y) {
  return fetch(TILE_URL(layer, ZOOM, x, y))
    .then((r) => {
      if (!r.ok) throw new Error(`Tile ${layer} ${x}/${y} failed (${r.status})`);
      return r.blob();
    })
    .then((blob) => {
      const img = new Image();
      img.src = URL.createObjectURL(blob);
      return new Promise((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = reject;
      });
    });
}

/* Compose the (2^zoom)² mercator tiles into a single 2048×2048 canvas. */
export function fetchMercatorTiles(layer) {
  const cached = tileCache.get(layer);
  if (cached) return cached;

  const promise = Promise.all(
    Array.from({ length: SIZE / 256 }, (_, y) =>
      Array.from({ length: SIZE / 256 }, (_, x) =>
        fetchTile(layer, x, y).then((img) => ({ img, x, y }))
      )
    ).flat()
  )
    .then((tiles) => {
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      for (const { img, x, y } of tiles) {
        ctx.drawImage(img, x * 256, y * 256);
      }
      return canvas;
    })
    .catch((e) => {
      tileCache.delete(layer);
      throw e;
    });
  tileCache.set(layer, promise);
  return promise;
}

/* Mercator Y (0..1, 0 = north pole) for a latitude in degrees. */
function mercatorY(latDeg) {
  const lat = (latDeg * Math.PI) / 180;
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + lat / 2)) / (2 * Math.PI);
}

/* Re-project a mercator canvas onto a half-height equirectangular canvas
   (2048×1024 for the z=3 tiles). `alphaMode` controls how the weather data
   is separated from the tile basemap (which differs per OWM layer):
     - 'keep':       use the tile alpha as-is (clouds)
     - 'clouds':     threshold tile alpha — clear-sky haze (a≈0-90) drops
                     out, only real cloud density (a≈110+) survives
     - 'luma':       keep bright pixels — dark basemaps (precipitation)
     - 'saturation': keep saturated pixels — pastel gradient basemaps (temp)
     - 'brightness': keep only the brightest pixels — light basemaps (wind) */
export function mercatorToEquirect(srcCanvas, { alphaMode = 'keep' } = {}) {
  const sw = srcCanvas.width;
  const sh = srcCanvas.height;
  const w = srcCanvas.width;
  const h = Math.round(srcCanvas.height / 2);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d');
  const src = srcCanvas.getContext('2d').getImageData(0, 0, sw, sh);
  const s = src.data;
  const dst = new ImageData(w, h);
  const d = dst.data;

  /* Precompute the source row for each output row (1D → cheap bilinear). */
  const srcRows = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    const lat = 90 - ((y + 0.5) / h) * 180;
    srcRows[y] = mercatorY(lat) * sh - 0.5;
  }

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const xScale = sw / w;

  for (let y = 0; y < h; y++) {
    const fy = clamp(srcRows[y], 0, sh - 1.001);
    const y0 = Math.floor(fy);
    const yf = fy - y0;
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      const fx = (x + 0.5) * xScale - 0.5;
      const x0 = clamp(Math.floor(fx), 0, sw - 1);
      const xf = fx - x0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = (y0 * sw + clamp(x0 + 1, 0, sw - 1)) * 4;
      const i01 = (clamp(y0 + 1, 0, sh - 1) * sw + x0) * 4;
      const i11 = (clamp(y0 + 1, 0, sh - 1) * sw + clamp(x0 + 1, 0, sw - 1)) * 4;

      let r = s[i00] * (1 - xf) * (1 - yf) + s[i10] * xf * (1 - yf) + s[i01] * (1 - xf) * yf + s[i11] * xf * yf;
      let g = s[i00 + 1] * (1 - xf) * (1 - yf) + s[i10 + 1] * xf * (1 - yf) + s[i01 + 1] * (1 - xf) * yf + s[i11 + 1] * xf * yf;
      let b = s[i00 + 2] * (1 - xf) * (1 - yf) + s[i10 + 2] * xf * (1 - yf) + s[i01 + 2] * (1 - xf) * yf + s[i11 + 2] * xf * yf;
      let a = s[i00 + 3] * (1 - xf) * (1 - yf) + s[i10 + 3] * xf * (1 - yf) + s[i01 + 3] * (1 - xf) * yf + s[i11 + 3] * xf * yf;

      if (alphaMode !== 'keep') {
        const mx = Math.max(r, g, b);
        const mn = Math.min(r, g, b);
        const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const sat = mx === 0 ? 0 : (mx - mn) / mx;
        let factor;
        if (alphaMode === 'clouds') {
          /* OWM cloud tiles cap alpha at ~127 — remap so only dense cloud
             tops survive and the sub-40% haze (the "white film") drops out. */
          factor = clamp((a / 255 - 0.4) / 0.15, 0, 1);
        } else if (alphaMode === 'luma') {
          factor = clamp((luma - 0.12) / 0.55, 0, 1);
        } else if (alphaMode === 'saturation') {
          factor = clamp(sat * 1.6, 0, 1);
        } else {
          factor = clamp((luma - 0.85) / 0.15, 0, 1);
        }
        a = factor * a;
        if (a < 0.02) {
          r = g = b = 0;
        }
      }

      const o = (rowOff + x) * 4;
      d[o] = r;
      d[o + 1] = g;
      d[o + 2] = b;
      d[o + 3] = a;
    }
  }

  octx.putImageData(dst, 0, 0);
  return out;
}

/* Live global cloud cover: OWM cloud tiles re-projected to equirect.
   Resolves to an <img>-like canvas (matches the old NASA GIBS contract). */
let cloudPromise = null;
export function loadLiveClouds() {
  if (!cloudPromise) {
    cloudPromise = fetchMercatorTiles('clouds_new')
      .then((canvas) => mercatorToEquirect(canvas, { alphaMode: 'clouds' }))
      .catch((e) => {
        cloudPromise = null;
        throw e;
      });
  }
  return cloudPromise;
}

/* Equirect weather overlay for a map layer (temperature/precipitation/wind). */
export function loadLayerEquirect(layer, alphaMode) {
  return fetchMercatorTiles(layer).then((canvas) =>
    mercatorToEquirect(canvas, { alphaMode })
  );
}
