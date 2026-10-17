import type { Sql } from "./db";
import type { Category, PrepRow } from "./normalize";

export type SessionRow = {
  dateKey: string;
  scanId: string | null;
  researchWatchlist: PrepRow[] | null;
  morningScan: { buySignals: PrepRow[]; watchSignals: PrepRow[] } | null;
  confirmationComplete: boolean | null;
  confirmationMessage: string | null;
  publishedAt: Date | null;
  noConfirmedBuys: boolean | null;
  studyResults: unknown[] | null;
  resultsReceivedAt: Date | null;
  isSample: boolean;
};

export type CandidateRow = {
  dateKey: string;
  ticker: string;
  name: string | null;
  rank: number | null;
  statusCode: string | null;
  statusLabel: string | null;
  category: Category | null;
  entry: number | null;
  stop: number | null;
  target: number | null;
  resultStatus: string | null;
  resultLabel: string | null;
  resultFinalized: boolean | null;
  executionPrice: number | null;
  exitPrice: number | null;
  profitPerShare: number | null;
  resultBasis: string | null;
  executionBasis: string | null;
};

export type SessionSummary = {
  dateKey: string;
  confirmationComplete: boolean | null;
  isSample: boolean;
  candidates: number;
  confirmed: number;
  completed: number;
  winners: number;
  losers: number;
  profitPerShareSum: number | null;
};

export type JournalRow = {
  id: string;
  dateKey: string;
  ticker: string;
  shares: number;
  fillPrice: number;
  exitPrice: number | null;
  fees: number;
  notes: string | null;
  createdAt: Date;
};

export type EventRow = {
  id: string;
  deliveryId: string;
  event: string;
  dateKey: string | null;
  sentAt: Date | null;
  receivedAt: Date;
  source: string;
  payload: unknown;
};

// date columns come back as text (YYYY-MM-DD) so no time zone shifts creep in.
const SESSION_COLS = `date_key::text AS "dateKey", scan_id AS "scanId", research_watchlist AS "researchWatchlist",
  morning_scan AS "morningScan", confirmation_complete AS "confirmationComplete",
  confirmation_message AS "confirmationMessage", published_at AS "publishedAt",
  no_confirmed_buys AS "noConfirmedBuys", study_results AS "studyResults",
  results_received_at AS "resultsReceivedAt", is_sample AS "isSample"`;

export async function getSession(sql: Sql, dateKey: string): Promise<SessionRow | null> {
  const rows = await sql.unsafe<SessionRow[]>(`SELECT ${SESSION_COLS} FROM sessions WHERE date_key = $1`, [dateKey]);
  return rows[0] ?? null;
}

/** Most recent session on or before the given date. */
export async function getLatestSession(sql: Sql, onOrBefore: string): Promise<SessionRow | null> {
  const rows = await sql.unsafe<SessionRow[]>(
    `SELECT ${SESSION_COLS} FROM sessions WHERE date_key <= $1 ORDER BY date_key DESC LIMIT 1`,
    [onOrBefore],
  );
  return rows[0] ?? null;
}

export async function getCandidates(sql: Sql, dateKey: string): Promise<CandidateRow[]> {
  return sql<CandidateRow[]>`
    SELECT date_key::text AS "dateKey", ticker, name, rank, status_code AS "statusCode",
      status_label AS "statusLabel", category, entry, stop, target, result_status AS "resultStatus",
      result_label AS "resultLabel", result_finalized AS "resultFinalized",
      execution_price AS "executionPrice", exit_price AS "exitPrice", profit_per_share AS "profitPerShare",
      result_basis AS "resultBasis", execution_basis AS "executionBasis"
    FROM candidates WHERE date_key = ${dateKey}
    ORDER BY rank NULLS LAST, ticker`;
}

export async function listSessionSummaries(sql: Sql, limit = 120): Promise<SessionSummary[]> {
  const rows = await sql<SessionSummary[]>`
    SELECT s.date_key::text AS "dateKey", s.confirmation_complete AS "confirmationComplete", s.is_sample AS "isSample",
      count(c.ticker)::int AS candidates,
      count(*) FILTER (WHERE c.category = 'confirmed')::int AS confirmed,
      count(*) FILTER (WHERE c.result_finalized AND c.profit_per_share IS NOT NULL)::int AS completed,
      count(*) FILTER (WHERE c.result_finalized AND c.profit_per_share > 0)::int AS winners,
      count(*) FILTER (WHERE c.result_finalized AND c.profit_per_share < 0)::int AS losers,
      sum(c.profit_per_share) FILTER (WHERE c.result_finalized) AS "profitPerShareSum"
    FROM sessions s LEFT JOIN candidates c ON c.date_key = s.date_key
    GROUP BY s.date_key
    ORDER BY s.date_key DESC
    LIMIT ${limit}`;
  return rows;
}

export async function listJournal(sql: Sql, limit = 500): Promise<JournalRow[]> {
  return sql<JournalRow[]>`
    SELECT id::text, date_key::text AS "dateKey", ticker, shares, fill_price AS "fillPrice",
      exit_price AS "exitPrice", fees, notes, created_at AS "createdAt"
    FROM journal_entries ORDER BY date_key DESC, created_at DESC LIMIT ${limit}`;
}

export async function journalTickersForDate(sql: Sql, dateKey: string): Promise<Set<string>> {
  const rows = await sql<{ ticker: string }[]>`SELECT DISTINCT ticker FROM journal_entries WHERE date_key = ${dateKey}`;
  return new Set(rows.map((r) => r.ticker));
}

export type JournalInput = {
  dateKey: string;
  ticker: string;
  shares: number;
  fillPrice: number;
  exitPrice: number | null;
  fees: number;
  notes: string | null;
};

export async function addJournalEntry(sql: Sql, e: JournalInput) {
  await sql`
    INSERT INTO journal_entries (date_key, ticker, shares, fill_price, exit_price, fees, notes)
    VALUES (${e.dateKey}, ${e.ticker}, ${e.shares}, ${e.fillPrice}, ${e.exitPrice}, ${e.fees}, ${e.notes})`;
}

export async function setJournalExit(sql: Sql, id: string, exitPrice: number | null) {
  await sql`UPDATE journal_entries SET exit_price = ${exitPrice}, updated_at = now() WHERE id = ${id}`;
}

export async function deleteJournalEntry(sql: Sql, id: string) {
  await sql`DELETE FROM journal_entries WHERE id = ${id}`;
}

export async function listEvents(sql: Sql, limit = 100): Promise<EventRow[]> {
  return sql<EventRow[]>`
    SELECT id::text, delivery_id AS "deliveryId", event, date_key::text AS "dateKey", sent_at AS "sentAt",
      received_at AS "receivedAt", source, payload
    FROM events ORDER BY received_at DESC, id DESC LIMIT ${limit}`;
}
