import { describe, expect, it } from "vitest";

import {
  DEFAULT_TIME_ZONE,
  addDateKeyDays,
  dateKeyInTimeZone,
  dateTimeLocalValue,
  inclusiveDateWindow,
  inclusiveDayCount,
  isDateKey,
  normalizeTimeZone,
  zonedDateTimeToIso,
} from "./date-time";

describe("IANA timezone foundation", () => {
  it("defaults invalid or absent preferences to IST", () => {
    expect(normalizeTimeZone(undefined)).toBe(DEFAULT_TIME_ZONE);
    expect(normalizeTimeZone("Not/AZone")).toBe(DEFAULT_TIME_ZONE);
    expect(normalizeTimeZone("America/New_York")).toBe("America/New_York");
  });

  it("formats an instant and parses datetime-local symmetrically in IST", () => {
    const instant = new Date("2026-06-20T04:00:00.000Z");
    expect(dateTimeLocalValue(instant, "Asia/Kolkata")).toBe("2026-06-20T09:30");
    expect(zonedDateTimeToIso("2026-06-20T09:30", "Asia/Kolkata")).toBe("2026-06-20T04:00:00.000Z");
  });

  it("uses the configured zone when an instant crosses a calendar-day boundary", () => {
    const instant = new Date("2026-06-20T20:00:00.000Z");
    expect(dateKeyInTimeZone(instant, "UTC")).toBe("2026-06-20");
    expect(dateKeyInTimeZone(instant, "Asia/Kolkata")).toBe("2026-06-21");
  });

  it("rejects nonexistent DST wall-clock times", () => {
    expect(zonedDateTimeToIso("2026-03-08T02:30", "America/New_York")).toBeNull();
  });
});

describe("date-only range foundation", () => {
  it("validates real date keys and performs calendar arithmetic", () => {
    expect(isDateKey("2026-02-29")).toBe(false);
    expect(isDateKey("2028-02-29")).toBe(true);
    expect(addDateKeyDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(inclusiveDayCount("2026-06-10", "2026-06-20")).toBe(11);
  });

  it("creates inclusive boundaries in the selected timezone", () => {
    const window = inclusiveDateWindow("2026-06-10", "2026-06-10", "Asia/Kolkata");
    expect(window.start.toISOString()).toBe("2026-06-09T18:30:00.000Z");
    expect(window.endExclusive.toISOString()).toBe("2026-06-10T18:30:00.000Z");
  });
});
