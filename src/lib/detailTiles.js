/* Deep-zoom detail patches — Esri World Imagery (keyless, CORS-enabled)
   satellite tiles fetched only while the camera rides close to the surface.
   The visible window is re-projected from Web-Mercator to an equirectangular
   patch, soft-faded at the edges so it melts into the base texture, and
   applied as a slightly-raised overlay sphere. Zoom level follows camera
   distance, so the deeper you zoom the sharper the map gets. */

const TILE_BASE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile';

/* z/x/y → Image promise; a simple FIFO cap keeps memory in check. */
const tileCache = new Map();
const CACHE_MAX = 600;

function tileURL(z, x, y) {
  return `${TILE_BASE}/${z}/${y}/${x}`;
}

function fetchTile(z, x, y) {
  const key = `${z}/${x}/${y}`;
  if (tileCache.has(key)) return tileCache.get(key);

  const p = fetch(tileURL(z, x, y))
    .then((r) => {
      if (!r.ok) throw new Error(`detail tile ${key} (${r.status})`);
      return r.blob();
    })
    .then(
      (blob) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.src = URL.createObjectURL(blob);
          img.onload = () => resolve(img);
          img.onerror = reject;
        })
    )
    .catch((e) => {
      tileCache.delete(key);
      throw e;
    });

  tileCache.set(key, p);
  if (tileCache.size > CACHE_MAX) {
    for (const k of tileCache.keys()) {
      tileCache.delete(k);
      if (tileCache.size <= CACHE_MAX - 200) break;
    }
  }
  return p;
}

function latToMercY(lat) {
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI);
}

function mercYToLat(y) {
  const n = Math.PI - 2 * Math.PI * y;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/* Zoom level for a given camera gap (distance from the surface, world units):
   deeper = more zoom = higher tile zoom. */
export function zoomForGap(g) {
  if (g > 1.05) return 5;
  if (g > 0.78) return 6;
  if (g > 0.58) return 7;
  if (g > 0.45) return 8;
  return 9;
}

/* Approximate surface span (degrees of longitude) the screen shows at a given
   camera gap — a ray at the horizontal FOV edge hits the sphere at a central
   angle that grows as the camera approaches. Used to size the tile patch so
   it (roughly) covers what the user sees instead of leaving a blurry ring. */
export function visibleSpanDeg(g) {
  const aspect =
    typeof window !== 'undefined' && window.innerHeight > 0
      ? window.innerWidth / window.innerHeight
      : 16 / 9;
  const halfH = Math.atan(Math.tan((25 * Math.PI) / 180) * aspect);
  const d = 1.5 + g;
  const s = Math.min(1, Math.sin(halfH) * (d / 1.5));
  const a = Math.asin(s) * (180 / Math.PI);
  return Math.min(135, Math.max(45, 2.15 * a));
}

/* Tile grid that adapts to the zoom band: at deep zoom a 12-tile row would
   cover only ~8° while the screen shows ~60°, so rows grow with z (capped
   at a fixed tile budget). The extra coverage is cheap because every band's
   patch is cached and only the newest band is fetched per camera move. */
export function gridFor(z, g) {
  const n = Math.pow(2, z);
  const wantX = Math.round((visibleSpanDeg(g) * n) / 360);
  const gridX = Math.min(20, Math.max(12, wantX));
  const gridY = Math.min(11, Math.max(7, Math.round(gridX * 0.55)));
  return { gridX, gridY };
}

/* Fetch a gridX×gridY tile patch centred on (lat, lon) at tile zoom z and
   re-project it to an equirectangular canvas. Resolves with the patch canvas
   plus its lat/lon bounds (for UV placement) — or rejects on any tile error. */
export async function loadDetailPatch({ lat, lon, z, gridX = 12, gridY = 7 }) {
  const n = Math.pow(2, z);
  const cx = Math.floor(((lon + 180) / 360) * n);
  const cy = Math.floor(latToMercY(clamp(lat, -84, 84)) * n);
  const x0 = ((cx - (gridX >> 1)) % n + n) % n;
  const y0 = clamp(cy - (gridY >> 1), 0, n - gridY);

  const rows = [];
  for (let gy = 0; gy < gridY; gy++) {
    const row = [];
    for (let gx = 0; gx < gridX; gx++) {
      row.push(fetchTile(z, (x0 + gx) % n, y0 + gy));
    }
    rows.push(Promise.all(row));
  }
  const tileRows = await Promise.all(rows);

  const sw = gridX * 256;
  const sh = gridY * 256;
  const merc = document.createElement('canvas');
  merc.width = sw;
  merc.height = sh;
  const mctx = merc.getContext('2d');
  for (let gy = 0; gy < gridY; gy++) {
    for (let gx = 0; gx < gridX; gx++) {
      mctx.drawImage(tileRows[gy][gx], gx * 256, gy * 256);
    }
  }

  const lonLeft = (x0 / n) * 360 - 180;
  const lonRight = ((x0 + gridX) / n) * 360 - 180;
  const latTop = mercYToLat(y0 / n);
  const latBot = mercYToLat((y0 + gridY) / n);

  /* Re-project mercator → equirect for this lat/lon window (bilinear). */
  const w = sw;
  const h = Math.max(64, Math.round((w * (latTop - latBot)) / (lonRight - lonLeft)));
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d');
  const src = mctx.getImageData(0, 0, sw, sh);
  const s = src.data;
  const dst = new ImageData(w, h);
  const d = dst.data;

  const yTopM = latToMercY(latTop);
  const ySpanM = latToMercY(latBot) - yTopM;
  const srcRows = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    const lat = latTop - ((y + 0.5) / h) * (latTop - latBot);
    srcRows[y] = ((latToMercY(lat) - yTopM) / ySpanM) * sh - 0.5;
  }

  const pxPerDeg = (n * 256) / 360;
  const xOff = x0 * 256 - (lonLeft + 180) * pxPerDeg;
  const wc = w / 2;
  const hc = h / 2;

  for (let y = 0; y < h; y++) {
    const fy = clamp(srcRows[y], 0, sh - 1.001);
    const y0i = Math.floor(fy);
    const yf = fy - y0i;
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      const lon = lonLeft + ((x + 0.5) / w) * (lonRight - lonLeft);
      const fx = clamp(lon * pxPerDeg + xOff, 0, sw - 1.001);
      const x0i = Math.floor(fx);
      const xf = fx - x0i;
      const i00 = (y0i * sw + x0i) * 4;
      const i10 = (y0i * sw + clamp(x0i + 1, 0, sw - 1)) * 4;
      const i01 = (clamp(y0i + 1, 0, sh - 1) * sw + x0i) * 4;
      const i11 = (clamp(y0i + 1, 0, sh - 1) * sw + clamp(x0i + 1, 0, sw - 1)) * 4;

      let r = s[i00] * (1 - xf) * (1 - yf) + s[i10] * xf * (1 - yf) + s[i01] * (1 - xf) * yf + s[i11] * xf * yf;
      let g = s[i00 + 1] * (1 - xf) * (1 - yf) + s[i10 + 1] * xf * (1 - yf) + s[i01 + 1] * (1 - xf) * yf + s[i11 + 1] * xf * yf;
      let b = s[i00 + 2] * (1 - xf) * (1 - yf) + s[i10 + 2] * xf * (1 - yf) + s[i01 + 2] * (1 - xf) * yf + s[i11 + 2] * xf * yf;
      let a = s[i00 + 3] * (1 - xf) * (1 - yf) + s[i10 + 3] * xf * (1 - yf) + s[i01 + 3] * (1 - xf) * yf + s[i11 + 3] * xf * yf;

/* Adaptive elliptical fade — tighter at high zoom, wider at low zoom
     to prevent visible seams. Uses smoothstep for C1 continuity. The
     ring is generous because patches are composited into a stack, so
     the fade edge melts into the next layer instead of the base map. */
  const zoomProgress = Math.min(1, Math.max(0, (9 - z) / 4));
  const fadeInner = 0.55 + 0.2 * zoomProgress;
  const fadeOuter = 0.95 + 0.04 * zoomProgress;
  const rx = (x - wc) / wc;
  const ry = (y - hc) / hc;
  const rad = Math.sqrt(rx * rx + ry * ry);
  a *= 1 - smoothstep(fadeInner, fadeOuter, rad);

      const o = (rowOff + x) * 4;
      d[o] = r;
      d[o + 1] = g;
      d[o + 2] = b;
      d[o + 3] = a;
    }
  }

  octx.putImageData(dst, 0, 0);

  /* Cap the patch canvas so a deep-zoom stack of 4 layers stays light. */
  if (out.width > 2048) {
    const scaled = document.createElement('canvas');
    scaled.width = 2048;
    scaled.height = Math.max(1, Math.round((out.height * 2048) / out.width));
    scaled.getContext('2d').drawImage(out, 0, 0, scaled.width, scaled.height);
    return { canvas: scaled, latTop, latBot, lonLeft, lonRight };
  }
  return { canvas: out, latTop, latBot, lonLeft, lonRight };
}
