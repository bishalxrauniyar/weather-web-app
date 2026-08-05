/* OpenWeatherMap map tiles — CORS-enabled raster overlays used for the
   live cloud cover and the temperature / precipitation / wind / pressure layers.
   Tiles are Web-Mercator; we compose them into one canvas and re-project
   to equirectangular so the globe's UV mapping samples them correctly.
   Includes a keyless procedural fallback engine when an API key is absent or fails. */

const API_KEY = import.meta.env.VITE_OPENWEATHER_KEY || "";
const TILE_URL = (layer, z, x, y) =>
  `https://tile.openweathermap.org/map/${layer}/${z}/${x}/${y}.png?appid=${API_KEY}`;

const ZOOM = 3;
const SIZE = 256 * Math.pow(2, ZOOM); /* 2048 */

const tileCache = new Map();

function fetchTile(layer, x, y) {
  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), 3500)
    : null;
  return fetch(
    TILE_URL(layer, ZOOM, x, y),
    controller ? { signal: controller.signal } : {},
  )
    .then((r) => {
      if (timeoutId) clearTimeout(timeoutId);
      if (!r.ok)
        throw new Error(`Tile ${layer} ${x}/${y} failed (${r.status})`);
      return r.blob();
    })
    .then((blob) => {
      if (timeoutId) clearTimeout(timeoutId);
      const img = new Image();
      img.src = URL.createObjectURL(blob);
      return new Promise((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = reject;
      });
    })
    .catch((e) => {
      if (timeoutId) clearTimeout(timeoutId);
      throw e;
    });
}

export function fetchMercatorTiles(layer) {
  if (!API_KEY) {
    return Promise.reject(
      new Error("No API key provided for OpenWeather tiles"),
    );
  }

  const cached = tileCache.get(layer);
  if (cached) return cached;

  const promise = Promise.all(
    Array.from({ length: SIZE / 256 }, (_, y) =>
      Array.from({ length: SIZE / 256 }, (_, x) =>
        fetchTile(layer, x, y).then((img) => ({ img, x, y })),
      ),
    ).flat(),
  )
    .then((tiles) => {
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d");
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

function mercatorY(latDeg) {
  const lat = (latDeg * Math.PI) / 180;
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + lat / 2)) / (2 * Math.PI);
}

export function mercatorToEquirect(srcCanvas, { alphaMode = "keep" } = {}) {
  const sw = srcCanvas.width;
  const sh = srcCanvas.height;
  const w = srcCanvas.width;
  const h = Math.round(srcCanvas.height / 2);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d", { willReadFrequently: true });
  const src = srcCanvas
    .getContext("2d", { willReadFrequently: true })
    .getImageData(0, 0, sw, sh);
  const s = src.data;
  const dst = new ImageData(w, h);
  const d = dst.data;

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
      const i11 =
        (clamp(y0 + 1, 0, sh - 1) * sw + clamp(x0 + 1, 0, sw - 1)) * 4;

      let r =
        s[i00] * (1 - xf) * (1 - yf) +
        s[i10] * xf * (1 - yf) +
        s[i01] * (1 - xf) * yf +
        s[i11] * xf * yf;
      let g =
        s[i00 + 1] * (1 - xf) * (1 - yf) +
        s[i10 + 1] * xf * (1 - yf) +
        s[i01 + 1] * (1 - xf) * yf +
        s[i11 + 1] * xf * yf;
      let b =
        s[i00 + 2] * (1 - xf) * (1 - yf) +
        s[i10 + 2] * xf * (1 - yf) +
        s[i01 + 2] * (1 - xf) * yf +
        s[i11 + 2] * xf * yf;
      let a =
        s[i00 + 3] * (1 - xf) * (1 - yf) +
        s[i10 + 3] * xf * (1 - yf) +
        s[i01 + 3] * (1 - xf) * yf +
        s[i11 + 3] * xf * yf;

      if (alphaMode !== "keep") {
        const mx = Math.max(r, g, b);
        const mn = Math.min(r, g, b);
        const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const sat = mx === 0 ? 0 : (mx - mn) / mx;
        let factor;
        if (alphaMode === "clouds") {
          factor = clamp((a / 255 - 0.4) / 0.15, 0, 1);
        } else if (alphaMode === "luma") {
          factor = clamp((luma - 0.12) / 0.55, 0, 1);
        } else if (alphaMode === "saturation") {
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

/* Keyless procedural equirectangular weather map layer generator */
export function generateProceduralEquirect(layer, _alphaMode = "keep") {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;

  const type = layer.replace("_new", "");

  for (let y = 0; y < h; y++) {
    const lat = 90 - (y / h) * 180;
    const latNorm = Math.abs(lat) / 90;

    for (let x = 0; x < w; x++) {
      const lon = (x / w) * 360 - 180;
      const idx = (y * w + x) * 4;

      const n1 = Math.sin(lat * 0.08) * Math.cos(lon * 0.08);
      const n2 = Math.sin(lat * 0.2 + lon * 0.15) * 0.5;
      const noise = (n1 + n2 + 1.5) / 3;

      if (type === "temp") {
        // Temperature heatmap: hot red/orange at equator, cyan/blue at poles
        const tempVal = 1 - latNorm * 0.85 + (noise - 0.5) * 0.3;
        const clampedVal = Math.max(0, Math.min(1, tempVal));
        if (clampedVal > 0.7) {
          data[idx] = 255;
          data[idx + 1] = Math.round((1 - (clampedVal - 0.7) / 0.3) * 200);
          data[idx + 2] = 50;
        } else if (clampedVal > 0.4) {
          data[idx] = Math.round(((clampedVal - 0.4) / 0.3) * 255);
          data[idx + 1] = 220;
          data[idx + 2] = Math.round((1 - (clampedVal - 0.4) / 0.3) * 200);
        } else {
          data[idx] = 30;
          data[idx + 1] = Math.round((clampedVal / 0.4) * 200);
          data[idx + 2] = 255;
        }
        data[idx + 3] = Math.round(180 * (0.6 + noise * 0.4));
      } else if (type === "precipitation" || type === "rain") {
        // Rain cells in tropical & mid-latitude bands
        const rainZone =
          Math.exp(-Math.pow((lat - 5) / 18, 2)) +
          Math.exp(-Math.pow((Math.abs(lat) - 45) / 15, 2)) * 0.7;
        const rainVal = rainZone * (noise > 0.55 ? (noise - 0.55) * 2.2 : 0);
        if (rainVal > 0.1) {
          data[idx] = Math.round(Math.min(255, rainVal * 300));
          data[idx + 1] = Math.round(Math.min(255, 255 - rainVal * 150));
          data[idx + 2] = Math.round(Math.min(255, 100 + rainVal * 100));
          data[idx + 3] = Math.round(Math.min(200, rainVal * 240));
        }
      } else if (type === "wind") {
        // Wind streamlines & vector flow bands
        const windWave = Math.sin(lat * 0.15 + Math.sin(lon * 0.05) * 2);
        const streak = Math.sin((x * 0.4 + y * 0.2) * 0.1) > 0.7 ? 1 : 0;
        const windVal =
          (0.3 + windWave * 0.4 + streak * 0.3) * (0.4 + noise * 0.6);
        if (windVal > 0.35) {
          data[idx] = 120;
          data[idx + 1] = 220;
          data[idx + 2] = 255;
          data[idx + 3] = Math.round((windVal - 0.35) * 220);
        }
      } else if (type === "pressure") {
        // Isobar pressure contours & H / L centers
        const pWave = Math.sin(lat * 0.06) * Math.cos(lon * 0.06);
        const isobar =
          Math.abs(Math.sin((pWave + noise * 0.3) * 12)) > 0.82 ? 1 : 0;
        if (isobar) {
          data[idx] = 255;
          data[idx + 1] = 255;
          data[idx + 2] = 255;
          data[idx + 3] = 160;
        }
      } else {
        // Default / Clouds: soft global cloud coverage
        const cloudVal = Math.max(0, (noise - 0.4) * 1.6);
        if (cloudVal > 0.05) {
          data[idx] = 245;
          data[idx + 1] = 250;
          data[idx + 2] = 255;
          data[idx + 3] = Math.round(Math.min(220, cloudVal * 200));
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

let cloudPromise = null;
export function loadLiveClouds() {
  if (!cloudPromise) {
    cloudPromise = fetchMercatorTiles("clouds_new")
      .then((canvas) => mercatorToEquirect(canvas, { alphaMode: "clouds" }))
      .catch(() => generateProceduralEquirect("clouds_new", "clouds"));
  }
  return cloudPromise;
}

export function loadLayerEquirect(layer, alphaMode) {
  if (!API_KEY) {
    return Promise.resolve(generateProceduralEquirect(layer, alphaMode));
  }
  return fetchMercatorTiles(layer)
    .then((canvas) => mercatorToEquirect(canvas, { alphaMode }))
    .catch(() => generateProceduralEquirect(layer, alphaMode));
}
