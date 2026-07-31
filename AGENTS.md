# AGENTS.md — WeatherVerse 3D Weather App

## Stack
- React 19 + Vite 8, Three.js (React Three Fiber), GSAP, Framer Motion, Tailwind CSS v4
- OpenWeather API (free tier — requires API key in `.env`)
- Zustand (state), TanStack React Query (data fetching), Leva (debug controls)

## API Key Setup
1. Get a free API key from https://openweathermap.org/api
2. Create `weather-app/.env`:
   ```
   VITE_OPENWEATHER_KEY=your_key_here
   ```

## Commands
- `npm run dev` — start Vite dev server
- `npm run build` — production build
- `npm run preview` — preview production build

## Architecture
### 3D Scene (`src/components/3d/`)
- `WeatherScene.jsx` — R3F Canvas with weather-dependent environment
- `SkyDome.jsx` — Dynamic vertex-colored sky dome that changes with weather
- `Clouds.jsx` — Procedural instanced cloud clusters with drift animation
- `RainParticles.jsx` — 15k GPU rain streaks with wind
- `SnowParticles.jsx` — 10k snowflakes with physics
- `Lightning.jsx` — Random lightning bolts + screen flash
- `Stars.jsx` — 3000 twinkling stars (night only)
- `Sun.jsx` — Animated sun with glow (daytime clear)
- `Moon.jsx` — Moon with ambient light (night)
- `Birds.jsx` — Flocking bird silhouettes (clear weather)
- `Fireflies.jsx` — Glowing particles (night)
- `Leaves.jsx` — Wind-blown leaves (windy weather)
- `Globe.jsx` — Interactive 3D globe with location pin
- `Terrain.jsx` — Procedural ground plane with snow/wet variants
- `FogEffect.jsx` — Volumetric fog particles

### UI Components (`src/components/ui/`)
- Glassmorphism cards with backdrop-filter
- Search bar with autocomplete + recent searches + favorites
- Animated numbers (GSAP), smooth transitions (Framer Motion)
- Custom cursor with ring follower
- Loading screen with gradient progress bar

### State & Data
- `weatherStore.js` — Zustand store for weather, location, UI state
- `useWeather.js` — React Query hooks for OpenWeather API (current + forecast + geocoding)

## Key Files
- `weather-app/src/App.jsx` — Root component
- `weather-app/src/components/3d/WeatherScene.jsx` — 3D canvas
- `weather-app/src/components/WeatherDashboard.jsx` — UI overlay
