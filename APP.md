# WeatherVerse — 3D Weather App

An interactive, 3D-globe weather explorer. Search any city, spin a live Earth,
ride the camera down to street-level satellite imagery, scrub the weather ahead
by 48 hours, and pin cities to a travel board — all in real time.

- React 19 + Vite, Three.js via React Three Fiber (R3F 9)
- Tailwind CSS v4, Framer Motion, GSAP
- Zustand state + TanStack React Query data fetching
- Weather data: OpenWeather (primary) with an automatic Open-Meteo fallback/merge
- Satellite imagery: Esri World Imagery (keyless), weather overlays: OpenWeather tiles

---

## Getting started

1. Get a free API key from <https://openweathermap.org/api>
2. Create `.env` in the repo root:
   ```
   VITE_OPENWEATHER_KEY=your_key_here
   ```
3. `npm install`
4. `npm run dev` — dev server on http://localhost:5173/
5. `npm run build` / `npm run preview` — production build

Without a key the app still works: forecasts fall back to Open-Meteo, and the
satellite/theme imagery is keyless.

---

## The 3D globe

The scene is one R3F canvas with a fully procedural, weather-reactive
environment. The earth itself is a `group` floating at `[0, -1.3, -3.5]`
(scaled 2.2×) whose rotation is user-driven; inside it lives the rotating
"earth mesh" (radius 1.5) carrying every surface feature so pins, labels,
weather overlays and satellite imagery stay glued to the surface through the
full 360° tumble.

### Scene components (`src/components/3d/`)
| Component | What it does |
|---|---|
| `Globe.jsx` | The earth mesh, all interaction (click/drag/wheel/pinch/keys), focus flights, pins, labels, and the deep-zoom state bus |
| `SkyDome.jsx` | Vertex-coloured sky dome that shifts with weather type |
| `Sky.jsx` / `Atmosphere.jsx` | Canvas gradient backdrop + additive atmosphere glow |
| `Sun.jsx` / `Moon.jsx` | Animated sun with glow (daytime) and moon (night) |
| `Stars.jsx` | 3000 twinkling stars, night only |
| `Clouds.jsx` | Instanced cloud clusters with drift; also a real cloud-map layer on the sphere |
| `RainParticles.jsx` / `SnowParticles.jsx` | 15k GPU rain streaks with wind; 10k snowflakes with physics |
| `Lightning.jsx` | Random lightning bolts + screen flash during storms |
| `Birds.jsx` / `Fireflies.jsx` / `Leaves.jsx` | Ambient life: flocks (clear days), glow particles (night), wind-blown leaves (windy) |
| `Terrain.jsx` / `Water.jsx` | Procedural ground that turns snowy/wet; water plane |
| `FogEffect.jsx` | Volumetric fog particles for misty weather |
| `Aurora.jsx` | Polar aurora at high latitudes |
| `MapLayer.jsx` | Weather data overlays — OpenWeather raster tiles re-projected onto the sphere (see Weather layers) |
| `DetailLayer.jsx` | Deep-zoom satellite mosaic (see Satellite deep-zoom) |
| `WeatherScene.jsx` | Canvas, lighting, `CameraSystem` (idle drift + focused aim), context-loss reboot |

### Controls
- **Click** a spot on the globe — selects that place (aim is resolved against a
  frozen camera+earth snapshot at pointer-down, so it lands exactly where you pressed).
- **Drag** — free 360° navigation: horizontal sweeps yaw, vertical sweeps pitch.
- **Mouse wheel / pinch / + / −** — zoom. In free mode the zoom is anchored on
  the point under the cursor (Google-Maps style); while a city is focused the
  camera rides along the centre→pin line so the city stays dead-centre.
  Zoom range: full-earth overview down to ~0.03 units off the surface.
- **Arrow keys** — rotate the globe in 15° steps.
- **Click a travel pin** — fly straight to that city.

### Focus flights
Searching or clicking a place rotates the globe so the city faces the camera,
then flies the camera down along the centre→pin line. The camera is ray-aimed
at the pin's *world* position every frame, so the city is dead-centre even
while the globe is still tumbling. Dragging/arrow keys/map-mode drop the focus.

---

## Earth themes & satellite deep-zoom

### Themes (`src/components/ui/EarthThemePicker.jsx`)
| Theme | Texture |
|---|---|
| **Satellite** | True-colour Earth (atmos map), default |
| **Map** | Flat-style OWM basemap tiles mosaicked at high zoom |
| **Countries** | Sand/beige relief with political borders stroked from Natural Earth GeoJSON |
| **Night** | Black-Marble: near-black base with city lights baked in (self-emissive) |

The theme textures are built on a canvas: the base map, a night version (city
lights composited with `lighter` blending), and a country version with borders
traced from a Natural Earth GeoJSON (cached after first fetch).

### Satellite deep-zoom (`src/lib/detailTiles.js` + `DetailLayer.jsx`)
While the camera rides close to the surface, the app fetches Esri World
Imagery tiles around the aim point and:

1. picks a tile zoom from the camera gap (z5 → z9 bands as you get closer),
2. fetches an adaptive tile grid (12–20 tiles wide, grows with zoom),
3. re-projects the Web-Mercator tiles to an equirectangular patch with soft
   elliptical edge fading (bilinear sampling),
4. composites the alive patch stack (oldest → newest, max 4 layers) into one
   mosaic canvas,
5. maps the mosaic onto a slightly-raised sphere via its exact lat/lon window
   (UV repeat/offset).

The stack keeps the whole screen covered by crisp imagery at every distance —
older blurrier patches stay beneath newer sharper ones instead of fading to the
base texture. The camera near plane is 0.01 so the surface stays in view at the
deepest zoom.

---

## Weather layers

Toggleable overlay tiles (`src/components/3d/MapLayer.jsx`), each re-projected
onto a sphere just above the surface and masked by alpha mode so only the
weather data shows (not the tile basemap):

- **Clouds** — cloud coverage raster
- **Temperature** — pastel heat gradient (saturation)
- **Precipitation** — rain raster (luma)
- **Wind** — wind vectors (brightness)
- **Pressure** — pressure field

---

## The dashboard

### Search (`src/components/ui/SearchBar.jsx`)
- Autocomplete geocoding with a debounced city search
- **Recent searches** (localStorage) and **favorite cities** with a star toggle
- Selecting a city flies the globe to it and loads its weather
- Selections are shared via URL params (`?name=…&lat=…&lon=…`) — copy the URL
  to deep-link any city

### Current conditions (`WeatherCard.jsx`)
Animated temperature (GSAP), condition, location chip, feels-like, and a
per-weather ambient scene.

### Metrics (`MetricGrid.jsx` + `GaugeRail.jsx`)
Wind speed/direction, humidity, visibility, pressure (with trend), sunrise/
sunset — formatted with real-world labels ("Fog", "Gale", "Dry air"...).

### Hourly forecast (`HourlyForecast.jsx`)
12-hour strip with temp sparkline and condition icons; clicking an hour opens
a day-detail modal for that day.

### 10-day forecast (`DailyForecast.jsx`)
- Per-day high/low with animated temp bars
- **Rain-by-hour bars**: a mini 24-bar chart per day, bar height = mm/h,
  with "hour — mm" tooltips (data from the keyless Open-Meteo hourly feed,
  falling back to a 3-hour spread when unavailable)

### Day detail modal (`DayDetail.jsx`)
Click any forecast day to open a modal with the hour strip, condition icons,
and a **rain chart** (SVG area chart of mm/h across the day with total and
peak precipitation, or a "dry day" state).

### Weather brief (`WeatherBrief.jsx`)
AI-style plain-language summary of current + forecast conditions.

### AQI / UV / alerts
Optional panels (preferences in the store): AQI index, UV forecast, and severe
weather alerts (Open-Meteo/OpenWeather, surfaced as warning chips).

### Travel board (`TravelBoard.jsx`)
Pin destinations to a board; each shows its current temp/condition and drops a
3D pin on the globe. Clicking a pin flies there. Works as a multi-city watchlist.

### Time travel
Scrub the scene forward up to +48 h: the sun, day/night terminator, clouds,
lightning and the forecast follow the simulated time.

### Misc
- Custom cursor with ring follower, sound toggle, glassmorphism cards,
  loading screen with gradient progress bar
- `DebugLeva.jsx` — Leva panel for live tweaking of scene parameters
- Mobile: the weather rail becomes a collapsible bottom sheet; collapsing it
  ("map mode") drops the focus flight so the whole globe fills the screen

---

## Data pipeline

- `src/hooks/useWeather.js` — React Query hooks: current weather, 5-day/3h
  forecast, geocoding, inverse geocoding, alerts, AQI/UV
- `src/lib/openMeteo.js` — keyless fallback: current, hourly (240 h) and daily
  forecasts merged into the OpenWeather shape (`_hourly` field with
  dt/rain/pop/temp/code/isDay)
- `src/storage/weatherUtils.js` — localStorage persistence helpers
- `src/store/weatherStore.js` — Zustand store: location, weather, UI state,
  layers, themes, travel board, favorites, time-travel clock, preferences

---

## Architecture notes

- **Click aim**: `selectFromClick` raycasts against the camera + earth
  matrices frozen at pointer-down (`clickCam`, `clickEarthInv`) and resolves
  the hit analytically against the unit sphere — immune to the focus flight
  that starts on pointer-down.
- **Deep-zoom state bus**: `detailBus` (module-scope) publishes the camera gap
  and aim point every frame; `DetailLayer` reads it to fetch/rebuild the mosaic.
- **Context-loss recovery**: the canvas remounts itself if the GPU context is
  lost and cannot restore.
- All textures are procedural/canvas-generated where possible; no external
  assets beyond the bundled maps and the tile APIs.
