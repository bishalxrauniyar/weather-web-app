import { useMemo } from 'react';
import { motion } from 'framer-motion';

function windLabel(kmh) {
  if (kmh < 5) return 'calm air';
  if (kmh < 20) return `a gentle ${Math.round(kmh)} km/h breeze`;
  if (kmh < 40) return `a brisk ${Math.round(kmh)} km/h wind`;
  return `strong winds around ${Math.round(kmh)} km/h`;
}

function buildBrief(weather, forecast, units) {
  if (!weather) return null;

  const t = Math.round(units === 'imperial' ? (weather.main.temp * 9) / 5 + 32 : weather.main.temp);
  const feels = Math.round(units === 'imperial' ? (weather.main.feels_like * 9) / 5 + 32 : weather.main.feels_like);
  const humidity = weather.main.humidity;
  const windKmh = (weather.wind?.speed || 0) * 3.6;
  const main = weather.weather?.[0]?.main || '';

  let nextRain = 0;
  if (forecast?.list) {
    nextRain = Math.max(...forecast.list.slice(0, 4).map((i) => i.pop || 0));
  }

  const story = [];
  const advice = [];

  /* Condition lead */
  const cond = main.toLowerCase();
  if (cond.includes('thunder')) story.push('Thunderstorms are brewing');
  else if (cond.includes('snow')) story.push('Snow is falling');
  else if (cond.includes('rain') || cond.includes('drizzle')) story.push('Rain is moving through');
  else if (cond.includes('fog') || cond.includes('mist')) story.push('Fog is settling in');
  else if (cond.includes('cloud')) story.push('Mostly cloudy');
  else if (cond.includes('clear') || cond.includes('sun')) story.push('Clear skies');
  else story.push('Steady conditions');

  /* Temperature translation */
  if (t >= 32) {
    story.push(`with a blistering ${t}° high`);
    advice.push('Stay hydrated and avoid midday sun — it is a scorcher.');
  } else if (t >= 27) {
    story.push(`and a warm ${t}° — short sleeves weather`);
    advice.push('Light layers and water are your friends today.');
  } else if (t <= 0) {
    story.push(`and a bitter ${t}°`);
    advice.push('Bundle up — exposed skin is at risk.');
  } else if (t <= 8) {
    story.push(`and a chilly ${t}°`);
    advice.push('A proper coat is worth it today.');
  } else {
    story.push(`with a comfortable ${t}°`);
  }

  /* Wind */
  if (windKmh >= 40) advice.push(`${windLabel(windKmh)} — secure loose outdoor items.`);
  else if (windKmh >= 20) story.push(`under ${windLabel(windKmh)}`);

  /* Rain timing */
  if (nextRain >= 0.7) {
    advice.push('Rain is likely within a few hours — keep an umbrella handy.');
  } else if (nextRain >= 0.4) {
    advice.push('A chance of showers later — worth packing an umbrella.');
  }

  /* Humidity */
  if (humidity >= 75 && t >= 24) {
    advice.push(`It feels sticky at ${humidity}% humidity — the air is heavy.`);
  } else if (humidity < 25) {
    advice.push('Very dry air — moisturize and keep water close.');
  }

  /* Feels-like delta */
  const delta = feels - t;
  if (delta <= -5) {
    story.push(`and feels like ${feels}° with the wind`);
  } else if (Math.abs(delta) <= 2) {
    story.push(`— what you see is what you feel`);
  }

  /* Fallback advice */
  if (advice.length === 0) {
    if (nextRain < 0.2) advice.push('No weather drama today — enjoy the outdoors.');
    else advice.push('A mostly comfortable day ahead.');
  }

  return {
    story: `${story.join(' ').replace(/\.$/, '')}.`,
    advice: advice.slice(0, 2).join(' '),
  };
}

export default function WeatherBrief({ weather, forecast, units = 'metric' }) {
  const brief = useMemo(() => buildBrief(weather, forecast, units), [weather, forecast, units]);

  if (!brief) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="brief"
    >
      <div className="brief-label">Today's story</div>
      <p className="brief-story">{brief.story}</p>
      {brief.advice && <p className="brief-advice">{brief.advice}</p>}
    </motion.div>
  );
}