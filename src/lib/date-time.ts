export const DEFAULT_TIME_ZONE = "Asia/Kolkata";

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(value: string | null | undefined): string {
  return value && isValidTimeZone(value) ? value : DEFAULT_TIME_ZONE;
}

export function supportedTimeZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: "timeZone") => string[] };
  const zones = intl.supportedValuesOf?.("timeZone") ?? [];
  return [...new Set([DEFAULT_TIME_ZONE, "UTC", ...zones])].sort((left, right) => left.localeCompare(right));
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute"), second: value("second") };
}

const pad = (value: number) => String(value).padStart(2, "0");

export function dateKeyInTimeZone(date: Date, timeZone: string): string {
  const part = zonedParts(date, normalizeTimeZone(timeZone));
  return `${part.year}-${pad(part.month)}-${pad(part.day)}`;
}

export function dateTimeLocalValue(date: Date, timeZone: string): string {
  const part = zonedParts(date, normalizeTimeZone(timeZone));
  return `${part.year}-${pad(part.month)}-${pad(part.day)}T${pad(part.hour)}:${pad(part.minute)}`;
}

function offsetMilliseconds(date: Date, timeZone: string): number {
  const part = zonedParts(date, timeZone);
  const representedAsUtc = Date.UTC(part.year, part.month - 1, part.day, part.hour, part.minute, part.second);
  return representedAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Convert a wall-clock datetime in an IANA zone to an absolute ISO instant. */
export function zonedDateTimeToIso(value: string, timeZone: string): string | null {
  const match = LOCAL_DATE_TIME.exec(value);
  const zone = normalizeTimeZone(timeZone);
  if (!match) return null;
  const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw, secondRaw = "0"] = match;
  const expected = {
    year: Number(yearRaw), month: Number(monthRaw), day: Number(dayRaw),
    hour: Number(hourRaw), minute: Number(minuteRaw), second: Number(secondRaw),
  };
  const naiveUtc = Date.UTC(expected.year, expected.month - 1, expected.day, expected.hour, expected.minute, expected.second);
  const native = new Date(naiveUtc);
  if (native.getUTCFullYear() !== expected.year || native.getUTCMonth() + 1 !== expected.month || native.getUTCDate() !== expected.day || expected.hour > 23 || expected.minute > 59 || expected.second > 59) return null;

  let instant = naiveUtc;
  for (let index = 0; index < 4; index += 1) {
    const adjusted = naiveUtc - offsetMilliseconds(new Date(instant), zone);
    if (adjusted === instant) break;
    instant = adjusted;
  }
  const actual = zonedParts(new Date(instant), zone);
  if (actual.year !== expected.year || actual.month !== expected.month || actual.day !== expected.day || actual.hour !== expected.hour || actual.minute !== expected.minute || actual.second !== expected.second) return null;
  return new Date(instant).toISOString();
}

export function isDateKey(value: string | null | undefined): value is string {
  if (!value || !DATE_KEY.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

export function addDateKeyDays(value: string, days: number): string {
  if (!isDateKey(value)) throw new Error(`Invalid date key: ${value}`);
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function startOfDateInTimeZone(value: string, timeZone: string): Date {
  const iso = zonedDateTimeToIso(`${value}T00:00`, timeZone);
  if (!iso) throw new Error(`Invalid date boundary: ${value}`);
  return new Date(iso);
}

export function inclusiveDateWindow(from: string, to: string, timeZone: string): { start: Date; endExclusive: Date } {
  return {
    start: startOfDateInTimeZone(from, timeZone),
    endExclusive: startOfDateInTimeZone(addDateKeyDays(to, 1), timeZone),
  };
}

export function inclusiveDayCount(from: string, to: string): number {
  if (!isDateKey(from) || !isDateKey(to) || from > to) return 0;
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

export function formatDateInTimeZone(date: Date | string, timeZone: string, options: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: normalizeTimeZone(timeZone), ...options }).format(typeof date === "string" ? new Date(date) : date);
}

export function formatDateTimeInTimeZone(date: Date | string, timeZone: string): string {
  return formatDateInTimeZone(date, timeZone, { dateStyle: "medium", timeStyle: "short" });
}

export function timeZoneLabel(timeZone: string, now = new Date()): string {
  const zone = normalizeTimeZone(timeZone);
  const offset = new Intl.DateTimeFormat("en-IN", { timeZone: zone, timeZoneName: "shortOffset" })
    .formatToParts(now).find((part) => part.type === "timeZoneName")?.value;
  return offset ? `${zone} (${offset})` : zone;
}
