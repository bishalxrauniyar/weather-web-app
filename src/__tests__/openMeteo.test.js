import { describe, it, expect, vi } from 'vitest';
import { openMeteoCurrent, openMeteoAirQuality } from '../lib/openMeteo';

describe('openMeteo keyless API mapper', () => {
  it('maps current weather API response to OpenWeather payload shape', async () => {
    const mockRes = {
      current: {
        time: '2026-08-05T12:00:00Z',
        temperature_2m: 22.5,
        relative_humidity_2m: 65,
        apparent_temperature: 23.0,
        is_day: 1,
        weather_code: 0,
        cloud_cover: 10,
        wind_speed_10m: 3.5,
        wind_direction_10m: 180,
        pressure_msl: 1013.25,
        visibility: 10000,
      },
      daily: {
        temperature_2m_max: [24.0],
        temperature_2m_min: [15.0],
        sunrise: ['2026-08-05T05:00:00Z'],
        sunset: ['2026-08-05T20:00:00Z'],
      },
      utc_offset_seconds: 3600,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockRes,
    });

    const result = await openMeteoCurrent(51.5074, -0.1278);
    expect(result.coord.lat).toBe(51.5074);
    expect(result.coord.lon).toBe(-0.1278);
    expect(result.main.temp).toBe(22.5);
    expect(result.weather[0].main).toBe('Clear');
    expect(result._source).toBe('open-meteo');
  });

  it('maps air quality API response accurately', async () => {
    const mockAQ = {
      current: {
        us_aqi: 42,
        pm2_5: 8.5,
        pm10: 15.2,
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockAQ,
    });

    const result = await openMeteoAirQuality(51.5074, -0.1278);
    expect(result.list[0].main.aqi).toBe(1); // 42 <= 50 -> AQI Good (1)
    expect(result.list[0].components.pm2_5).toBe(8.5);
    expect(result._source).toBe('open-meteo');
  });
});
