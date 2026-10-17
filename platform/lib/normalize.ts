/**
 * Turns a KamdenAI webhook payload into the session/candidate patches the store applies.
 * Pure: no I/O, so it is unit-tested directly against the sample payloads.
 *
 * Rules carried over from the public docs:
 * - Research watchlist and morning scan are preparation only; they never create candidates.
 * - Status comes from the payload's statusLabel; raw codes are preserved, not re-mapped.
 * - A morning result counts as completed only when finalized with a numeric profitPerShare.
 */

export type Category = "confirmed" | "watch" | "no_buy" | "ungraded" | "other";

export type PrepRow = { ticker: string; name: string | null; entry: number | null; stop: number | null; target: number | null };

export type CandidatePatch = {
  ticker: string;
  name: string | null;
  rank: number | null;
  statusCode: string | null;
  statusLabel: string | null;
  category: Category | null;
  entry: number | null;
  stop: number | null;
  target: number | null;
  result: ResultPatch | null;
};

export type ResultPatch = {
  status: string | null;
  statusLabel: string | null;
  finalized: boolean;
  executionPrice: number | null;
  exitPrice: number | null;
  profitPerShare: number | null;
  resultBasis: string | null;
  executionBasis: string | null;
};

export type SessionPatch = {
  scanId?: string | null;
  researchWatchlist?: PrepRow[];
  morningScan?: { buySignals: PrepRow[]; watchSignals: PrepRow[] };
  confirmationComplete?: boolean | null;
  confirmationMessage?: string | null;
  publishedAt?: string | null;
  noConfirmedBuys?: boolean | null;
  studyResults?: unknown[];
  resultsReceived?: boolean;
};

export type IngestPlan = {
  event: string;
  dateKey: string | null;
  sentAt: string | null;
  session: SessionPatch | null;
  candidates: CandidatePatch[];
};

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);

export function categorize(statusLabel: string | null, statusCode: string | null): Category | null {
  if (!statusLabel && !statusCode) return null;
  const label = (statusLabel ?? "").trim().toLowerCase();
  if (label.startsWith("confirmed")) return "confirmed";
  if (label.startsWith("watch")) return "watch";
  if (label === "no buy") return "no_buy";
  if (label === "ungraded") return "ungraded";
  if (!label && statusCode === "confirmed_buy") return "confirmed";
  return "other";
}

function prepRow(v: unknown): PrepRow | null {
  if (!isObj(v) || !str(v.ticker)) return null;
  return { ticker: str(v.ticker)!, name: str(v.name), entry: num(v.entry), stop: num(v.stop), target: num(v.target) };
}

const prepRows = (v: unknown) => arr(v).map(prepRow).filter((r): r is PrepRow => r !== null);

function result(v: unknown): ResultPatch | null {
  if (!isObj(v) || !isObj(v.quickExit)) return null;
  const q = v.quickExit;
  return {
    status: str(q.status),
    statusLabel: str(q.statusLabel),
    finalized: q.finalized === true,
    executionPrice: num(q.executionPrice),
    exitPrice: num(q.price),
    profitPerShare: num(q.profitPerShare),
    resultBasis: str(q.resultBasis),
    executionBasis: str(q.executionBasis),
  };
}

function candidate(v: unknown, opts: { forceConfirmed?: boolean } = {}): CandidatePatch | null {
  if (!isObj(v) || !str(v.ticker)) return null;
  const oc = isObj(v.openingConfirmation) ? v.openingConfirmation : {};
  let statusCode = str(oc.status);
  let statusLabel = str(oc.statusLabel);
  if (opts.forceConfirmed && !statusCode && !statusLabel) {
    statusCode = "confirmed_buy";
    statusLabel = "Confirmed buy";
  }
  return {
    ticker: str(v.ticker)!,
    name: str(v.name),
    rank: num(oc.officialRank),
    statusCode,
    statusLabel,
    category: categorize(statusLabel, statusCode),
    entry: num(v.entry),
    stop: num(v.stop),
    target: num(v.target),
    result: result(v.result),
  };
}

/** Later rows for the same ticker fill in fields earlier rows left empty. */
function mergeByTicker(rows: CandidatePatch[]): CandidatePatch[] {
  const map = new Map<string, CandidatePatch>();
  for (const row of rows) {
    const prev = map.get(row.ticker);
    if (!prev) {
      map.set(row.ticker, row);
      continue;
    }
    const merged = { ...prev };
    for (const key of Object.keys(row) as (keyof CandidatePatch)[]) {
      if (merged[key] === null && row[key] !== null) (merged as Json)[key] = row[key];
    }
    map.set(row.ticker, merged);
  }
  return [...map.values()];
}

export function normalize(payload: unknown, headerEvent: string | null = null): IngestPlan {
  const p = isObj(payload) ? payload : {};
  const event = str(p.event) ?? headerEvent ?? "unknown";
  const data = isObj(p.data) ? p.data : {};
  const plan: IngestPlan = { event, dateKey: str(p.dateKey), sentAt: str(p.sentAt), session: null, candidates: [] };

  switch (event) {
    case "research_watchlist.created":
      plan.session = { researchWatchlist: prepRows(data.researchWatchlist) };
      break;

    case "morning_scan.created": {
      const scan = isObj(data.scan) ? data.scan : {};
      plan.dateKey ??= str(scan.dateKey);
      plan.session = {
        scanId: str(data.scanId),
        morningScan: { buySignals: prepRows(scan.buySignals), watchSignals: prepRows(scan.watchSignals) },
      };
      break;
    }

    case "confirmed_buys.created": {
      plan.session = {
        scanId: str(data.scanId),
        confirmationComplete: bool(data.confirmationComplete),
        confirmationMessage: str(data.message),
        publishedAt: str(data.publishedAt),
      };
      const rows = [
        ...arr(data.confirmationResults).map((r) => candidate(r)),
        ...arr(data.confirmedBuys).map((r) => candidate(r, { forceConfirmed: true })),
      ].filter((r): r is CandidatePatch => r !== null);
      plan.candidates = mergeByTicker(rows);
      break;
    }

    case "quick_exit_results.created":
      plan.session = {
        scanId: str(data.scanId),
        noConfirmedBuys: bool(data.noConfirmedBuys),
        studyResults: arr(data.studyResults),
        resultsReceived: true,
      };
      plan.candidates = mergeByTicker(
        arr(data.quickExitResults)
          .map((r) => candidate(r))
          .filter((r): r is CandidatePatch => r !== null),
      );
      break;

    default:
      // webhook.test and unknown events are logged in the events table only.
      break;
  }

  if (!plan.dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(plan.dateKey)) {
    plan.dateKey = null;
    plan.session = null;
    plan.candidates = [];
  }
  return plan;
}

/** A modeled result is a completed record only when finalized with a numeric return. */
export function isCompletedResult(r: { finalized: boolean | null; profitPerShare: number | null }): boolean {
  return r.finalized === true && typeof r.profitPerShare === "number";
}
