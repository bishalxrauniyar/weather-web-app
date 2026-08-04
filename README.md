# WeatherVerse — 3D Interactive Weather Globe

A real-time 3D weather application with an interactive globe, day/night terminator, regional cloud cover, air quality, weather alerts, and travel destination pins. Built with React + Vite + Three.js (React Three Fiber).

## Stack

- **React 19** + **Vite 8**
- **Three.js** (React Three Fiber) — 3D globe with dynamic sky, clouds, rain, snow, lightning, atmosphere
- **TanStack React Query** — data fetching & caching
- **Zustand** — global state
- **GSAP** — animated numbers & transitions
- **Framer Motion** — UI animations
- **Tailwind CSS v4**

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up your OpenWeather API key

Get a free key at https://openweathermap.org/api, then create a `.env` file:

```bash
VITE_OPENWEATHER_KEY=your_key_here
```

The app also works **without an API key** — it falls back to the free, keyless Open-Meteo API for weather, forecast, AQI, geocoding, and alerts. Some features (detailed alerts, OneCall data) require a paid OWM key.

### 3. Start the dev server

```bash
npm run dev
```

Open http://localhost:5173

### 4. Build for production

```bash
npm run build
npm run preview
```

## How to Use

- **Drag** the globe to rotate it
- **Scroll** to zoom in/out (or use `+` / `-` keys)
- **Arrow keys** to rotate the globe (when not focused on a location)
- **Click** anywhere on the earth to fly there, see the place name, and load local weather
- **Search** for a city in the top bar to fly there
- Click the **locate** button (crosshair) to use your browser's geolocation
- Click the **refresh** button to re-fetch weather data
- Toggle **°C / °F** with the segmented control in the top bar
- **Travel board** — pin multiple destinations and compare their weather side-by-side
- The **detail modal** (click any metric tile) shows deep-dive stats and practical advice for that condition

## Features

- **3D interactive globe** with day/night terminator that follows the real sun position
- **Real-time regional clouds** (Open-Meteo, keyless) with NASA GIBS live-fallback
- **Day/night lighting** — the 3D sun light orbits the globe to match the true sub-solar point
- **Air Quality Index** (US EPA) — displayed as a color chip next to the location name
- **Weather alerts** — dismissible banner for severe weather warnings
- **Travel pins** — drop multiple destinations on the globe, fly to each, compare weather
- **Local time** — 12-hour clock (AM/PM) shown next to every location
- **Error resilience** — graceful fallback to Open-Meteo when OWM fails; scene crash recovery with a reload button
- **Reduced-motion** support — respects `prefers-reduced-motion`
- **PWA** — offline fallback page + service worker with asset precaching

## Project Structure

```
src/
├── App.jsx                # Root component + scene boundary error fallback
├── main.jsx               # Entry point
├── components/
│   ├── WeatherDashboard.jsx   # Main UI overlay (search, metrics, alerts, travel)
│   ├── WeatherDetail.jsx      # Detail modal (temperature, wind, humidity, UV, etc.)
│   ├── TravelBoard.jsx        # Multi-destination travel panel
│   ├── ui/                    # Reusable UI (SearchBar, HourlyStrip, DailyForecast, etc.)
│   └── 3d/                    # Three.js scene (Globe, WeatherScene, Clouds, Rain, etc.)
├── hooks/useWeather.js      # Data hooks: OWM + Open-Meteo fallback, AQI, geocoding
├── lib/openMeteo.js         # Open-Meteo keyless API wrappers
├── store/weatherStore.js    # Zustand global state
├── storage/weatherUtils.js  # Unit conversion, wind direction, dew point, etc.
├── public/                  # Static assets (offline.html, textures, sw.js)
└── index.css                # Global styles (glassmorphism, animations, a11y)
```

## License

MIT
