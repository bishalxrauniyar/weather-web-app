# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

The repo root holds a standalone `index.html` (a self-contained demo unrelated to the React app) and `weather-app/`, the actual project. All work happens inside `weather-app/`. There is an existing `AGENTS.md` describing the same app from a feature angle — this file focuses on architecture and commands.

## Commands

All commands run from `weather-app/`. There is no test framework configured.

- `npm run dev` — start Vite dev server
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the production build locally
- `npm run lint` — run Oxlint (`oxlint`, configured in `.oxlintrc.json`; only `react/rules-of-hooks` errors and `react/only-export-components` warns are enabled — no full eslint setup)

## Environment

OpenWeather API key is required or queries silently no-op (React Query `enabled: !!API_KEY`). Create `weather-app/.env`:
```
VITE_OPENWEATHER_KEY=your_key_here
```
`.env` already exists in this checkout; check it has a real key before assuming data will load. The `.gitignore` does NOT ignore `.env` — be careful not to commit a real key.

## Architecture

Single-page React 19 + Vite app. The whole experience is a full-viewport 3D scene with an HTML UI overlay floating on top; there is no router.

### Data flow (one direction)
1. `useWeather.js` — React Query hooks (`useCurrentWeather`, `useForecast`, `useCitySearch`) hit OpenWeather's `/data/2.5` and `/geo/1.0` endpoints. Query keys are keyed on `location.lat/lon`; location changes automatically re-fetch. `staleTime` 5 min for weather, 1 hr for geocode.
2. `weatherStore.js` — Zustand store is the single source of truth for `weatherType`, `isDaytime`, `location`, favorites/recent searches (persisted to `localStorage`), and UI flags (`soundEnabled`, `particleDensity`). `setWeather` derives `weatherType` and `isDaytime` from the raw API response via a `getWeatherType(code)` switch on OpenWeather condition IDs.
3. `WeatherDashboard.jsx` — bridges the two: subscribes to React Query results in an `useEffect` and pushes them into the Zustand store via `setWeather`/`setForecast`/`setLoading`/`setError`. Both the 3D scene and the UI read from the store, not from React Query directly, so this bridge is the only thing that writes weather into the store.

### Two rendering layers (mounted in `App.jsx`)
- `WeatherScene` (lazy) — R3F `<Canvas>` rendering all `src/components/3d/*` meshes. Every 3D component reads `weatherType`/`isDaytime` from the store and shows/hides itself accordingly. Scene background color, fog density, and postprocessing (`EffectComposer` with Bloom/Noise/Vignette) are derived from `weatherType` in `WeatherScene.jsx`. `CameraController` does mouse-parallax on the camera each frame.
- `WeatherDashboard` (lazy) — the HTML overlay. Renders `fixed inset-0 pointer-events-none`, with `pointer-events-auto` re-enabled on the interactive container so the 3D canvas stays draggable underneath. Layout: header (SearchBar + SoundToggle), main (WeatherCard on the left, HourlyForecast + ForecastCard on the right), footer with city/country.

### 3D component convention (`src/components/3d/`)
Each file is one self-contained effect (Rain, Snow, Lightning, Birds, Fireflies, etc.) that conditionally renders based on the current weather type and animates itself in a `useFrame` loop. Particle systems use GPU instancing with counts in the thousands (rain 15k, snow 10k, stars 3000) — preserve this pattern; don't fall back to per-object meshes. `Globe.jsx` is the interactive location picker.

## Styling

Tailwind CSS v4 via `@tailwindcss/vite` (no `tailwind.config.js`; the plugin auto-detects). `index.css` defines CSS custom properties for the glassmorphism design system (`--glass-bg`, `--accent`, etc.) plus `.glass` / `.glass-light` utility classes and custom keyframes (`float`, `aurora`, `shimmer`). Use these variables/classes for consistency rather than re-declaring glass values inline. The custom cursor (`CustomCursor.jsx`) drives `cursor: none` globally; this is overridden back to `auto` on touch via the `max-width: 768px` media query in `index.css`.

## Conventions

- JS only — no TypeScript despite `@types/*` devDeps present.
- Components use default exports (lazy-loaded in `App.jsx`).
- Weather-type string values (`'clear'`, `'rain'`, `'thunderstorm'`, `'snow'`, `'mist'`, `'partly-cloudy'`, `'cloudy'`, `'drizzle'`) flow from `getWeatherType` through the store to all scene components — match these exact strings when adding weather-dependent behavior.
