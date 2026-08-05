import { describe, it, expect } from "vitest";
import {
  zoomForGap,
  visibleSpanDeg,
  gridFor,
  lonToPatchX,
} from "../lib/detailTiles";

describe("detailTiles math", () => {
  it("calculates correct zoom levels for various camera distance gaps", () => {
    expect(zoomForGap(1.2)).toBe(5);
    expect(zoomForGap(0.9)).toBe(6);
    expect(zoomForGap(0.7)).toBe(7);
    expect(zoomForGap(0.5)).toBe(8);
    expect(zoomForGap(0.4)).toBe(9);
    expect(zoomForGap(0.2)).toBe(9);
  });

  it("calculates visible span in degrees within reasonable bounds [45, 135]", () => {
    const spanFar = visibleSpanDeg(1.2);
    const spanClose = visibleSpanDeg(0.2);

    expect(spanFar).toBeGreaterThanOrEqual(45);
    expect(spanFar).toBeLessThanOrEqual(135);

    expect(spanClose).toBeGreaterThanOrEqual(45);
    expect(spanClose).toBeLessThanOrEqual(135);
  });

  it("returns valid grid sizes based on zoom and distance gap", () => {
    const gridDeep = gridFor(9, 0.2);
    expect(gridDeep.gridX).toBeGreaterThanOrEqual(12);
    expect(gridDeep.gridX).toBeLessThanOrEqual(20);
    expect(gridDeep.gridY).toBeGreaterThanOrEqual(7);
    expect(gridDeep.gridY).toBeLessThanOrEqual(11);
  });

  it("maps longitudes into patch-local x coordinates without global offset drift", () => {
    const lonLeft = 60;
    const lonRight = 90;
    const width = 2048;

    const left = lonToPatchX(lonLeft, lonLeft, lonRight, width);
    const mid = lonToPatchX((lonLeft + lonRight) / 2, lonLeft, lonRight, width);
    const right = lonToPatchX(lonRight, lonLeft, lonRight, width);

    expect(left).toBeCloseTo(-0.5, 6);
    expect(mid).toBeCloseTo(width / 2 - 0.5, 6);
    expect(right).toBeCloseTo(width - 0.5, 6);
  });
});
