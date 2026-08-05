import { describe, it, expect, vi } from 'vitest';
import { generateProceduralEquirect, loadLayerEquirect } from '../lib/owmTiles';

describe('owmTiles procedural fallbacks', () => {
  it('generates valid canvas for temperature layer', () => {
    const canvas = generateProceduralEquirect('temp_new', 'saturation');
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(canvas.width).toBe(1024);
    expect(canvas.height).toBe(512);
  });

  it('generates valid canvas for precipitation layer', () => {
    const canvas = generateProceduralEquirect('precipitation_new', 'luma');
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(canvas.width).toBe(1024);
    expect(canvas.height).toBe(512);
  });

  it('generates valid canvas for wind layer', () => {
    const canvas = generateProceduralEquirect('wind_new', 'brightness');
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(canvas.width).toBe(1024);
    expect(canvas.height).toBe(512);
  });

  it('generates valid canvas for clouds layer', () => {
    const canvas = generateProceduralEquirect('clouds_new', 'clouds');
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(canvas.width).toBe(1024);
    expect(canvas.height).toBe(512);
  });

  it('generates valid canvas for pressure layer', () => {
    const canvas = generateProceduralEquirect('pressure_new', 'luma');
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(canvas.width).toBe(1024);
    expect(canvas.height).toBe(512);
  });

  it('loadLayerEquirect resolves to canvas in keyless/fallback mode', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network tile error'));
    const canvas = await loadLayerEquirect('temp_new', 'saturation');
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(canvas.width).toBe(1024);
    expect(canvas.height).toBe(512);
  });
});
