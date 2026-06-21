import { describe, expect, it } from "vitest";

import { SCREEN_TOURS, tourKeyForPath } from "./tour-registry";

describe("screen tour registry", () => {
  it("maps each authenticated screen path to a registered tour", () => {
    const paths: Record<string, string> = {
      "/": "overview",
      "/trades": "trades",
      "/trades/new": "trade-new",
      "/analytics": "analytics",
      "/risk": "risk",
      "/review": "review",
      "/calendar": "calendar",
      "/notes": "notes",
      "/reports": "reports",
      "/settings": "settings",
    };
    for (const [path, key] of Object.entries(paths)) {
      expect(tourKeyForPath(path)).toBe(key);
      expect(SCREEN_TOURS[key]).toBeDefined();
    }
  });

  it("returns null for non-tour routes", () => {
    expect(tourKeyForPath("/trades/abc123")).toBeNull();
    expect(tourKeyForPath("/notes/new")).toBeNull();
    expect(tourKeyForPath("/onboarding/2fa")).toBeNull();
  });

  it("every tour has a title, intro and at least one step, and step keys are self-consistent", () => {
    for (const [key, tour] of Object.entries(SCREEN_TOURS)) {
      expect(tour.key).toBe(key);
      expect(tour.title.length).toBeGreaterThan(0);
      expect(tour.intro.length).toBeGreaterThan(0);
      expect(tour.steps.length).toBeGreaterThan(0);
      for (const step of tour.steps) {
        expect(step.title.length).toBeGreaterThan(0);
        expect(step.body.length).toBeGreaterThan(0);
      }
    }
  });
});
