import { zonedDateTimeToIso } from "@/lib/date-time";
import { NOTE_COLLECTIONS, NOTE_TYPES, type NoteCollection, type NoteType, type RichTextDoc } from "@/lib/domain/notes";
import { evaluateTradeEntry, type TradeEntryDraft } from "@/lib/domain/trade-entry";
import type { AssetClass, Currency, Direction, InstrumentType, TradeStatus } from "@/lib/domain/types";

export const TRADEVAULT_EXPORT_FORMAT = "tradevault_export_v3" as const;
export const ACCEPTED_EXPORT_FORMATS = ["tradevault_export_v1", "tradevault_export_v2", TRADEVAULT_EXPORT_FORMAT] as const;

const ASSET_CLASSES: AssetClass[] = ["Equity", "Index", "Forex", "Commodity", "US Index", "Crypto"];
const INSTRUMENT_TYPES: InstrumentType[] = ["Cash", "Futures", "Options"];
const DIRECTIONS: Direction[] = ["Long", "Short"];
const STATUSES: TradeStatus[] = ["open", "closed"];
const CURRENCIES: Currency[] = ["INR", "USD"];
const MAX_TRADES = 10_000;
const MAX_LIBRARY_ITEMS = 5_000;
const MAX_NOTES = 10_000;

export interface ImportLibraryItem {
  name: string;
  description?: string | null;
}

export interface ImportPlaybook {
  name: string;
  marketScope: string | null;
  setupRules: string[];
  notes: string | null;
}

export interface ImportInstrument {
  symbol: string;
  name: string | null;
  assetClass: AssetClass;
  instrumentType: InstrumentType;
  subcategory: string | null;
  tradingStyle: string | null;
  quantity: number | null;
  multiplier: number | null;
  platform: string | null;
  currency: Currency;
  expiryDate: string | null;
  optionSide: "Call" | "Put" | null;
  strikePrice: number | null;
}

export interface ImportChecklistItem {
  id: string;
  label: string;
  phase: "entry" | "exit";
  completed: boolean;
}

export interface NormalizedImportTrade extends TradeEntryDraft {
  exportRef: string | null;
  strategyName: string | null;
  playbookName: string | null;
  closeReasonName: string | null;
  subcategory: string | null;
  tradingStyle: string | null;
  platform: string | null;
  emotion: string | null;
  tags: string[];
  ruleViolations: string | null;
  linkedNote: string | null;
  notes: string | null;
  setupChecklist: ImportChecklistItem[];
}

export interface NormalizedImportNote {
  exportRef: string | null;
  title: string;
  bodyText: string;
  bodyJson: RichTextDoc | null;
  noteType: NoteType;
  collection: NoteCollection;
  isTemplate: boolean;
  pinned: boolean;
  linkedTradeRef: string | null;
  linkedPlaybookName: string | null;
  updatedAt: string | null;
}

export interface NormalizedTradeVaultImport {
  format: typeof ACCEPTED_EXPORT_FORMATS[number];
  strategies: ImportLibraryItem[];
  closeReasons: ImportLibraryItem[];
  playbooks: ImportPlaybook[];
  instruments: ImportInstrument[];
  trades: NormalizedImportTrade[];
  notes: NormalizedImportNote[];
}

export type ParseImportResult =
  | { ok: true; value: NormalizedTradeVaultImport }
  | { ok: false; errors: string[] };

type UnknownRecord = Record<string, unknown>;

const record = (value: unknown): value is UnknownRecord => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const own = (value: UnknownRecord, key: string) => Object.prototype.hasOwnProperty.call(value, key);

function optionalString(value: unknown, max = 10_000): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean ? clean.slice(0, max) : null;
}

function requiredString(value: unknown, max = 200): string | null {
  return optionalString(value, max);
}

function finiteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

function optionalDate(value: unknown, timeZone: string): string | null {
  const raw = optionalString(value, 64);
  if (!raw) return null;
  const zoned = zonedDateTimeToIso(raw, timeZone);
  if (zoned) return zoned;
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function optionalDateOnly(value: unknown): string | null {
  const raw = optionalString(value, 10);
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function stringArray(value: unknown, limit = 100, maxLength = 200): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, maxLength)).filter(Boolean))].slice(0, limit);
}

function legacyStringList(value: unknown, limit = 200, maxLength = 1_000): string[] {
  if (Array.isArray(value)) return stringArray(value, limit, maxLength);
  const text = optionalString(value, 20_000);
  if (!text) return [];
  try {
    const decoded: unknown = JSON.parse(text);
    if (Array.isArray(decoded)) return stringArray(decoded, limit, maxLength);
  } catch {
    // v1 stored free-form textarea content, not necessarily JSON.
  }
  return [...new Set(text.split(/\r?\n|\s*;\s*/).map((item) => item.replace(/^[-*]\s*/, "").trim().slice(0, maxLength)).filter(Boolean))].slice(0, limit);
}

function legacyTags(value: unknown): string[] {
  if (Array.isArray(value)) return stringArray(value);
  const raw = optionalString(value, 2_000);
  return raw ? [...new Set(raw.split(",").map((tag) => tag.trim()).filter(Boolean))].slice(0, 100) : [];
}

function checklist(value: unknown): ImportChecklistItem[] {
  if (!Array.isArray(value)) return [];
  const items: ImportChecklistItem[] = [];
  for (const [index, raw] of value.slice(0, 200).entries()) {
    if (!record(raw)) continue;
    const label = requiredString(raw.label, 500);
    if (!label) continue;
    items.push({
      id: optionalString(raw.id, 100) ?? `imported-${index + 1}`,
      label,
      phase: raw.phase === "exit" ? "exit" : "entry",
      completed: raw.completed === true,
    });
  }
  return items;
}

function parseLibrary(value: unknown, key: string, errors: string[], nameKeys: string[] = ["name"]): ImportLibraryItem[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    errors.push(`${key} must be an array.`);
    return [];
  }
  if (value.length > MAX_LIBRARY_ITEMS) errors.push(`${key} exceeds the ${MAX_LIBRARY_ITEMS.toLocaleString()} item limit.`);
  const result: ImportLibraryItem[] = [];
  value.slice(0, MAX_LIBRARY_ITEMS).forEach((item, index) => {
    if (!record(item)) {
      errors.push(`${key}[${index}] must be an object.`);
      return;
    }
    const name = nameKeys.map((nameKey) => requiredString(item[nameKey])).find(Boolean) ?? null;
    if (!name) {
      errors.push(`${key}[${index}] needs a name.`);
      return;
    }
    result.push({ name, description: optionalString(item.description) });
  });
  return result;
}

function parsePlaybooks(value: unknown, errors: string[]): ImportPlaybook[] {
  const library = parseLibrary(value, "playbooks", errors);
  if (!Array.isArray(value)) return [];
  return library.map((item) => {
    const raw = value.find((candidate) => record(candidate) && requiredString(candidate.name) === item.name) as UnknownRecord | undefined;
    return {
      name: item.name,
      marketScope: optionalString(raw?.market_scope ?? raw?.marketScope, 500),
      setupRules: [...new Set([
        ...legacyStringList(raw?.setup_rules ?? raw?.setupRules, 200, 1_000),
        ...legacyStringList(raw?.checklist, 200, 1_000),
      ])].slice(0, 200),
      notes: optionalString(raw?.notes),
    };
  });
}

function parseInstruments(value: unknown, errors: string[]): ImportInstrument[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    errors.push("instruments must be an array.");
    return [];
  }
  if (value.length > MAX_LIBRARY_ITEMS) errors.push(`instruments exceeds the ${MAX_LIBRARY_ITEMS.toLocaleString()} item limit.`);
  const result: ImportInstrument[] = [];
  value.slice(0, MAX_LIBRARY_ITEMS).forEach((raw, index) => {
    if (!record(raw)) {
      errors.push(`instruments[${index}] must be an object.`);
      return;
    }
    const symbol = requiredString(raw.symbol ?? raw.name, 80)?.toUpperCase();
    if (!symbol) {
      errors.push(`instruments[${index}] needs a name or symbol.`);
      return;
    }
    const quantity = finiteNumber(raw.default_quantity ?? raw.quantity);
    const multiplier = finiteNumber(raw.lot_size ?? raw.default_multiplier ?? raw.multiplier);
    result.push({
      symbol,
      name: optionalString(raw.display_name ?? (raw.symbol ? raw.name : null), 200),
      assetClass: enumValue(raw.asset_category ?? raw.assetClass, ASSET_CLASSES, "Equity"),
      instrumentType: enumValue(raw.instrument_type ?? raw.instrumentType, INSTRUMENT_TYPES, "Cash"),
      subcategory: optionalString(raw.subcategory, 200),
      tradingStyle: optionalString(raw.trading_style ?? raw.defaultTradingStyle, 200),
      quantity: quantity != null && quantity > 0 ? quantity : null,
      multiplier: multiplier != null && multiplier > 0 ? multiplier : null,
      platform: optionalString(raw.platform ?? raw.defaultPlatform, 200),
      currency: enumValue(raw.currency ?? raw.default_currency, CURRENCIES, "INR"),
      expiryDate: optionalDateOnly(raw.expiry_date ?? raw.expiryDate),
      optionSide: raw.option_side === "Call" || raw.optionSide === "Call" ? "Call"
        : raw.option_side === "Put" || raw.optionSide === "Put" ? "Put" : null,
      strikePrice: finiteNumber(raw.strike_price ?? raw.strikePrice),
    });
  });
  return result;
}

function parseTrade(raw: unknown, index: number, timeZone: string, errors: string[]): NormalizedImportTrade | null {
  const path = `trades[${index}]`;
  if (!record(raw)) {
    errors.push(`${path} must be an object.`);
    return null;
  }
  const symbol = requiredString(raw.instrument ?? raw.symbol, 80)?.toUpperCase() ?? null;
  const entryAt = optionalDate(raw.entry_datetime ?? raw.entryAt, timeZone);
  const status = enumValue(raw.status, STATUSES, "open");
  const direction = enumValue(raw.direction, DIRECTIONS, "Long");
  const assetClass = enumValue(raw.asset_category ?? raw.assetClass, ASSET_CLASSES, "Equity");
  const instrumentType = enumValue(raw.instrument_type ?? raw.instrumentType, INSTRUMENT_TYPES, "Cash");
  const currency = enumValue(raw.currency, CURRENCIES, "INR");
  const entryPrice = finiteNumber(raw.entry_price ?? raw.entryPrice);
  const quantity = finiteNumber(raw.position_size ?? raw.quantity);
  const multiplierRaw = finiteNumber(raw.lot_size ?? raw.multiplier);
  const exitAt = optionalDate(raw.exit_datetime ?? raw.exitAt, timeZone);
  const exitPrice = finiteNumber(raw.exit_price ?? raw.exitPrice);
  const stopLoss = finiteNumber(raw.stop_loss ?? raw.stopLoss);
  const plannedTarget = finiteNumber(raw.planned_target ?? raw.plannedTarget);
  const manualPnl = finiteNumber(raw.manual_pnl ?? raw.manualPnl);
  const mfePrice = finiteNumber(raw.mfe_price ?? raw.mfePrice);
  const maePrice = finiteNumber(raw.mae_price ?? raw.maePrice);
  const fees = finiteNumber(raw.fees) ?? 0;
  const fxToAccount = finiteNumber(raw.fx_to_account ?? raw.fxToAccount) ?? 1;
  const confidenceRaw = finiteNumber(raw.execution_score ?? raw.confidence);
  const confidence = confidenceRaw == null ? null : Math.trunc(confidenceRaw);
  const optionSideRaw = raw.option_side ?? raw.optionSide;

  if (!symbol) errors.push(`${path} needs an instrument or symbol.`);
  if (!entryAt) errors.push(`${path} needs a valid entry date and time.`);
  if (entryPrice == null) errors.push(`${path} needs a numeric entry price.`);
  if (quantity == null) errors.push(`${path} needs a numeric position size or quantity.`);
  if (!symbol || !entryAt || entryPrice == null || quantity == null) return null;

  const psychology = optionalString(raw.psychology, 500);
  const psychologyDetail = optionalString(raw.psychology_detail, 2_000);
  const notes = optionalString(raw.review_notes ?? raw.notes) ?? optionalString(raw.exit_notes);
  const ruleViolations = optionalString(raw.rule_violations ?? raw.ruleViolations)
    ?? (own(raw, "rule_followed") && raw.rule_followed === false ? "Imported legacy review marked rules not followed." : null);
  const draft: NormalizedImportTrade = {
    exportRef: optionalString(raw.export_ref ?? raw.exportRef, 100),
    symbol,
    assetClass,
    instrumentType,
    direction,
    status,
    currency,
    entryAt,
    entryPrice,
    exitAt,
    exitPrice,
    quantity,
    multiplier: multiplierRaw != null && multiplierRaw > 0 ? multiplierRaw : 1,
    stopLoss,
    plannedTarget,
    manualPnl,
    mfePrice,
    maePrice,
    fees,
    fxToAccount,
    confidence,
    expiryDate: optionalDateOnly(raw.expiry_date ?? raw.expiryDate),
    optionSide: optionSideRaw === "Call" || optionSideRaw === "Put" ? optionSideRaw : null,
    strikePrice: finiteNumber(raw.strike_price ?? raw.strikePrice),
    strategyName: optionalString(raw.strategy, 200),
    playbookName: optionalString(raw.playbook_name ?? raw.playbookName, 200),
    closeReasonName: optionalString(raw.close_reason ?? raw.closeReason, 200),
    subcategory: optionalString(raw.subcategory, 200),
    tradingStyle: optionalString(raw.trading_style ?? raw.tradingStyle, 200),
    platform: optionalString(raw.platform, 200),
    emotion: [psychology, psychologyDetail].filter(Boolean).join(" · ") || optionalString(raw.emotion, 2_000),
    tags: legacyTags(raw.tags ?? raw.mistake_tags),
    ruleViolations,
    linkedNote: optionalString(raw.entry_notes ?? raw.linkedNote),
    notes,
    setupChecklist: checklist(raw.setup_checklist ?? raw.setupChecklist),
  };
  const evaluation = evaluateTradeEntry(draft);
  for (const [field, message] of Object.entries(evaluation.errors)) errors.push(`${path}.${field}: ${message}`);
  return Object.keys(evaluation.errors).length ? null : draft;
}

function parseNotes(value: unknown, timeZone: string, errors: string[]): NormalizedImportNote[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    errors.push("notes must be an array.");
    return [];
  }
  if (value.length > MAX_NOTES) errors.push(`notes exceeds the ${MAX_NOTES.toLocaleString()} item limit.`);
  const result: NormalizedImportNote[] = [];
  value.slice(0, MAX_NOTES).forEach((raw, index) => {
    if (!record(raw)) {
      errors.push(`notes[${index}] must be an object.`);
      return;
    }
    const title = requiredString(raw.title, 500);
    if (!title) {
      errors.push(`notes[${index}] needs a title.`);
      return;
    }
    const bodyJson = record(raw.body_json ?? raw.bodyJson) ? raw.body_json ?? raw.bodyJson as RichTextDoc : null;
    const updatedRaw = raw.updated_at ?? raw.updatedAt;
    const updatedAt = updatedRaw == null ? null : optionalDate(updatedRaw, timeZone);
    if (updatedRaw != null && !updatedAt) errors.push(`notes[${index}] has an invalid updated date.`);
    result.push({
      exportRef: optionalString(raw.export_ref ?? raw.exportRef, 100),
      title,
      bodyText: optionalString(raw.body_text ?? raw.bodyText) ?? "",
      bodyJson: bodyJson as RichTextDoc | null,
      noteType: enumValue(raw.note_type ?? raw.noteType, NOTE_TYPES, "general"),
      collection: enumValue(raw.collection, NOTE_COLLECTIONS, "none"),
      isTemplate: raw.is_template === true || raw.isTemplate === true,
      pinned: raw.pinned === true,
      linkedTradeRef: optionalString(raw.linked_trade_ref ?? raw.linkedTradeRef, 100),
      linkedPlaybookName: optionalString(raw.linked_playbook_name ?? raw.linkedPlaybookName, 200),
      updatedAt,
    });
  });
  return result;
}

/** Parse and fully validate an export before an importer is allowed to mutate data. */
export function parseTradeVaultImport(input: unknown, timeZone: string): ParseImportResult {
  const errors: string[] = [];
  if (!record(input)) return { ok: false, errors: ["The selected file must contain a JSON object."] };
  const format = typeof input.format === "string" && ACCEPTED_EXPORT_FORMATS.includes(input.format as typeof ACCEPTED_EXPORT_FORMATS[number])
    ? input.format as typeof ACCEPTED_EXPORT_FORMATS[number]
    : null;
  if (!format) errors.push(`Unsupported export format. Expected ${ACCEPTED_EXPORT_FORMATS.join(", ")}.`);
  if (!Array.isArray(input.trades)) errors.push("trades must be an array.");
  if (Array.isArray(input.trades) && input.trades.length > MAX_TRADES) errors.push(`trades exceeds the ${MAX_TRADES.toLocaleString()} item limit.`);

  const strategies = parseLibrary(input.strategies, "strategies", errors);
  const closeReasons = parseLibrary(input.close_reasons ?? input.closeReasons, "close_reasons", errors, ["reason", "name"]);
  const playbooks = parsePlaybooks(input.playbooks, errors);
  const instruments = parseInstruments(input.instruments, errors);
  const trades = Array.isArray(input.trades)
    ? input.trades.slice(0, MAX_TRADES).map((trade, index) => parseTrade(trade, index, timeZone, errors)).filter((trade): trade is NormalizedImportTrade => Boolean(trade))
    : [];
  const notes = parseNotes(input.notes, timeZone, errors);
  if (!format || errors.length) return { ok: false, errors: [...new Set(errors)].slice(0, 100) };
  return { ok: true, value: { format, strategies, closeReasons, playbooks, instruments, trades, notes } };
}

const canonicalNumber = (value: number) => Number(value.toPrecision(15)).toString();

export function tradeImportSignature(trade: Pick<NormalizedImportTrade, "symbol" | "entryAt" | "direction" | "entryPrice" | "quantity" | "multiplier" | "currency">): string {
  return [trade.symbol.trim().toUpperCase(), new Date(trade.entryAt).toISOString(), trade.direction, canonicalNumber(trade.entryPrice), canonicalNumber(trade.quantity), canonicalNumber(trade.multiplier), trade.currency].join("|");
}

export function noteImportSignature(note: Pick<NormalizedImportNote, "title" | "bodyText" | "noteType" | "collection" | "linkedTradeRef" | "linkedPlaybookName">): string {
  return [note.title.trim().toLocaleLowerCase(), note.bodyText.trim(), note.noteType, note.collection, note.linkedTradeRef ?? "", note.linkedPlaybookName?.trim().toLocaleLowerCase() ?? ""].join("|");
}
