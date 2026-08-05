import { describe, it, expect, beforeEach } from "vitest";
import {
  useWeatherStore,
  sunDaytime,
  getWeatherColor,
  getWeatherIcon,
} from "../store/weatherStore";

describe("weatherStore state & utilities", () => {
  beforeEach(() => {
    useWeatherStore.setState({
      location: {
        name: "London",
        lat: 51.5074,
        lon: -0.1278,
        country: "",
        state: "",
      },
      weatherLayers: {
        clouds: true,
        precipitation: false,
        wind: false,
        temperature: false,
        pressure: false,
      },
      earthTheme: "satellite",
      units: "metric",
      travelDestinations: [],
      favorites: [],
    });
  });

  it("toggles weather layers correctly", () => {
    const store = useWeatherStore.getState();
    expect(store.weatherLayers.precipitation).toBe(false);

    store.toggleWeatherLayer("precipitation");
    expect(useWeatherStore.getState().weatherLayers.precipitation).toBe(true);

    store.toggleWeatherLayer("precipitation");
    expect(useWeatherStore.getState().weatherLayers.precipitation).toBe(false);
  });

  it("updates earth theme", () => {
    const store = useWeatherStore.getState();
    expect(store.earthTheme).toBe("satellite");

    store.setEarthTheme("night");
    expect(useWeatherStore.getState().earthTheme).toBe("night");
  });

  it("adds and removes travel destinations", () => {
    const store = useWeatherStore.getState();
    const dest = { name: "Paris", lat: 48.8566, lon: 2.3522 };

    store.addTravelDestination(dest);
    expect(useWeatherStore.getState().travelDestinations.length).toBe(1);
    expect(useWeatherStore.getState().travelDestinations[0].name).toBe("Paris");

    store.removeTravelDestination(0);
    expect(useWeatherStore.getState().travelDestinations.length).toBe(0);
  });

  it("calculates solar daytime state accurately", () => {
    // London summer noon -> daytime
    const summerNoon = new Date("2026-06-21T12:00:00Z").getTime();
    expect(sunDaytime(51.5074, -0.1278, summerNoon)).toBe(true);

    // London summer midnight -> night
    const summerMidnight = new Date("2026-06-21T00:00:00Z").getTime();
    expect(sunDaytime(51.5074, -0.1278, summerMidnight)).toBe(false);
  });

  it("returns valid weather colors and icons", () => {
    expect(getWeatherColor("clear")).toBe("#0a2a5a");
    expect(getWeatherColor("rain")).toBe("#0a0a18");

    expect(getWeatherIcon("clear")).toBe("☀");
    expect(getWeatherIcon("rain")).toBe("🌧");
  });

  it("updates performance profile and debug toggles", () => {
    const store = useWeatherStore.getState();
    expect(store.performanceTier).toBeDefined();

    store.setPerformanceProfile({ tier: "medium", multiplier: 0.8 });
    expect(useWeatherStore.getState().performanceTier).toBe("medium");
    expect(useWeatherStore.getState().performanceMultiplier).toBe(0.8);

    const before = useWeatherStore.getState().debugHud;
    store.toggleDebugHud();
    expect(useWeatherStore.getState().debugHud).toBe(!before);
  });
});
