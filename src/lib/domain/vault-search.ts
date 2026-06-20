import type { Currency } from "@/lib/domain/types";

export const VAULT_SEARCH_KINDS = ["trade", "instrument", "strategy", "playbook", "note"] as const;

export type VaultSearchKind = (typeof VAULT_SEARCH_KINDS)[number];

export interface VaultSearchItem {
  id: string;
  kind: VaultSearchKind;
  title: string;
  meta: string;
  href: string;
  currency?: Currency;
  amount?: number | null;
  direction?: "Long" | "Short";
  status?: "open" | "closed";
}

/** Server-only ranking fields are stripped before a result crosses the API boundary. */
export interface VaultSearchCandidate extends VaultSearchItem {
  searchText: string;
  sortAtIso: string;
}

const kindOrder = new Map<VaultSearchKind, number>(VAULT_SEARCH_KINDS.map((kind, index) => [kind, index]));

function normalized(value: string) {
  return value.normalize("NFKD").toLocaleLowerCase("en-US").replace(/\s+/g, " ").trim();
}

function publicItem(candidate: VaultSearchCandidate): VaultSearchItem {
  return {
    id: candidate.id,
    kind: candidate.kind,
    title: candidate.title,
    meta: candidate.meta,
    href: candidate.href,
    currency: candidate.currency,
    amount: candidate.amount,
    direction: candidate.direction,
    status: candidate.status,
  };
}

function newestFirst(a: VaultSearchCandidate, b: VaultSearchCandidate) {
  return Date.parse(b.sortAtIso) - Date.parse(a.sortAtIso)
    || (kindOrder.get(a.kind) ?? 99) - (kindOrder.get(b.kind) ?? 99)
    || a.title.localeCompare(b.title);
}

/**
 * Pure search oracle shared by the repository and Vitest. Every query term must match.
 * Exact/prefix title matches outrank body/metadata matches. With no query, results are
 * interleaved by record kind so one busy journal cannot hide every library category.
 */
export function rankVaultSearchCandidates(
  candidates: readonly VaultSearchCandidate[],
  query: string,
  limit = 15,
): VaultSearchItem[] {
  const boundedLimit = Math.min(Math.max(limit, 1), 30);
  const cleanQuery = normalized(query).slice(0, 100);

  if (!cleanQuery) {
    const queues = new Map<VaultSearchKind, VaultSearchCandidate[]>();
    for (const kind of VAULT_SEARCH_KINDS) {
      queues.set(kind, candidates.filter((candidate) => candidate.kind === kind).sort(newestFirst));
    }
    const interleaved: VaultSearchCandidate[] = [];
    while (interleaved.length < boundedLimit && [...queues.values()].some((queue) => queue.length > 0)) {
      for (const kind of VAULT_SEARCH_KINDS) {
        const next = queues.get(kind)?.shift();
        if (next) interleaved.push(next);
        if (interleaved.length === boundedLimit) break;
      }
    }
    return interleaved.map(publicItem);
  }

  const terms = cleanQuery.split(" ").filter(Boolean);
  return candidates
    .map((candidate) => {
      const title = normalized(candidate.title);
      const haystack = normalized(`${candidate.title} ${candidate.searchText} ${candidate.meta} ${candidate.kind}`);
      if (!terms.every((term) => haystack.includes(term))) return null;
      let score = title === cleanQuery ? 1_000 : title.startsWith(cleanQuery) ? 700 : title.includes(cleanQuery) ? 500 : 0;
      for (const term of terms) {
        if (title.split(/[^a-z0-9]+/).some((word) => word.startsWith(term))) score += 80;
        else if (title.includes(term)) score += 40;
        else score += 10;
      }
      return { candidate, score };
    })
    .filter((ranked): ranked is { candidate: VaultSearchCandidate; score: number } => ranked !== null)
    .sort((a, b) => b.score - a.score || newestFirst(a.candidate, b.candidate))
    .slice(0, boundedLimit)
    .map(({ candidate }) => publicItem(candidate));
}
