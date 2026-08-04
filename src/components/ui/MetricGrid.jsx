import { motion } from 'framer-motion';
import { MetricIcon } from './icons';
import { toUnit, unitSymbol } from '../../storage/weatherUtils';

const DIRECTIONS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

function windDir(deg) {
  if (deg == null) return '';
  return DIRECTIONS[Math.round(deg / 22.5) % 16];
}

function humidityLabel(h) {
  if (h < 25) return 'Dry air';
  if (h < 50) return 'Comfortable';
  if (h < 70) return 'Mildly humid';
  return 'Humid';
}

function visibilityLabel(km) {
  if (km >= 10) return 'Clear line of sight';
  if (km >= 5) return 'Moderate';
  return 'Reduced — take care';
}

function pressureTrend(p) {
  if (p >= 1022) return 'High · settled';
  if (p <= 1000) return 'Low · unsettled';
  return 'Steady';
}

function formatTime(unix) {
  if (!unix) return '--:--';
  return new Date(unix * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function MetricGrid({ weather, onSelect, units = 'metric' }) {
  if (!weather) return null;

  const temp = toUnit(weather.main.temp, units);
  const feels = toUnit(weather.main.feels_like, units);
  const windKmh = Math.round((weather.wind?.speed || 0) * 3.6);
  const windGust = weather.wind?.gust ? Math.round(weather.wind.gust * 3.6) : null;
  const humidity = weather.main.humidity;
  const pressure = weather.main.pressure;
  const visibilityKm = (weather.visibility / 1000).toFixed(0);
  const clouds = weather.clouds?.all ?? 0;
  const uv = Math.max(0, Math.min(11, Math.round((11 - clouds / 10) * (weather.weather[0].id === 800 ? 1 : 0.75))));
  const uvLabel = uv <= 2 ? 'Low' : uv <= 5 ? 'Moderate' : uv <= 7 ? 'High' : 'Very high';

  const tiles = [
    {
      type: 'TEMPERATURE',
      icon: 'feelslike',
      label: 'Feels like',
      value: `${feels}${unitSymbol(units)}`,
      sub: `Actual ${temp}${unitSymbol(units)}${Math.abs(feels - temp) >= 3 ? ` · ${feels > temp ? 'feels warmer' : 'feels cooler'}` : ' · matches'} `,
    },
    {
      type: 'WIND',
      icon: 'wind',
      label: 'Wind',
      value: `${windKmh}`,
      unit: 'km/h',
      sub: windDir(weather.wind?.deg) ? `${windDir(weather.wind?.deg)}${windGust ? ` · gusts to ${windGust}` : ' · steady'}` : 'Calm',
    },
    {
      type: 'HUMIDITY',
      icon: 'drop',
      label: 'Humidity',
      value: `${humidity}`,
      unit: '%',
      sub: humidityLabel(humidity),
    },
    {
      type: 'UV INDEX',
      icon: 'uv',
      label: 'UV index',
      value: `${uv}`,
      sub: `${uvLabel} ${uv >= 6 ? '· protect skin' : ''}`,
    },
    {
      type: 'VISIBILITY',
      icon: 'eye',
      label: 'Visibility',
      value: `${visibilityKm}`,
      unit: 'km',
      sub: visibilityLabel(Number(visibilityKm)),
    },
    {
      type: 'PRESSURE',
      icon: 'gauge',
      label: 'Pressure',
      value: `${pressure}`,
      unit: 'hPa',
      sub: pressureTrend(pressure),
    },
    {
      type: 'SUNRISE',
      icon: 'sunrise',
      label: 'Sunrise',
      value: formatTime(weather.sys?.sunrise),
      sub: 'Good morning',
    },
    {
      type: 'SUNSET',
      icon: 'sunset',
      label: 'Sunset',
      value: formatTime(weather.sys?.sunset),
      sub: 'Golden hour',
    },
  ];

  return (
    <section>
      <div className="section-label">At a glance</div>
      <div className="metric-grid">
        {tiles.map((tile, i) => (
          <motion.button
            key={tile.type}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="metric-tile text-left"
            onClick={() => onSelect(tile.type)}
          >
            <div className="metric-head">
              <span className="metric-head-icon">
                <MetricIcon name={tile.icon} size={14} />
              </span>
              <span>{tile.label}</span>
            </div>
            <div className="metric-value">
              {tile.value}
              {tile.unit && <span style={{ fontSize: 13, color: 'var(--text-lo)', marginLeft: 3 }}>{tile.unit}</span>}
            </div>
            <div className="metric-sub">{tile.sub}</div>
          </motion.button>
        ))}
      </div>
    </section>
  );
}