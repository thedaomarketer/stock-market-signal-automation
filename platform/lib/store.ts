import crypto from "node:crypto";
import type postgres from "postgres";
import type { Sql } from "./db";
import { normalize, type CandidatePatch, type IngestPlan } from "./normalize";

export type IngestInput = {
  rawBody: string;
  deliveryId: string | null;
  headerEvent: string | null;
  source: "webhook" | "sample";
};

export type IngestOutcome = { duplicate: boolean; event: string; dateKey: string | null; candidates: number };

const json = (sql: Sql, v: unknown) => (v === undefined ? null : sql.json(v as postgres.JSONValue));
/**
 * Stores the raw delivery, then applies it to sessions/candidates in one transaction.
 * A repeated delivery id is acknowledged without being applied twice.
 */
export async function ingest(sql: Sql, input: IngestInput): Promise<IngestOutcome> {
  const payload: unknown = JSON.parse(input.rawBody);
  const plan = normalize(payload, input.headerEvent);
  const deliveryId = input.deliveryId || `sha256:${crypto.createHash("sha256").update(input.rawBody).digest("hex")}`;

  return sql.begin(async (txRaw) => {
    const tx = txRaw as unknown as Sql;
    const inserted = await tx`
      INSERT INTO events (delivery_id, event, date_key, sent_at, source, payload)
      VALUES (${deliveryId}, ${plan.event}, ${plan.dateKey}, ${plan.sentAt}, ${input.source}, ${json(tx, payload)})
      ON CONFLICT (delivery_id) DO NOTHING
      RETURNING id`;
    if (inserted.length === 0) {
      return { duplicate: true, event: plan.event, dateKey: plan.dateKey, candidates: 0 };
    }
    await applyPlan(tx, plan, input.source === "sample");
    return { duplicate: false, event: plan.event, dateKey: plan.dateKey, candidates: plan.candidates.length };
  });
}

async function applyPlan(tx: Sql, plan: IngestPlan, isSample: boolean) {
  if (!plan.dateKey || !plan.session) return;
  const s = plan.session;

  // COALESCE keeps earlier values when a later event omits a field, so events may arrive in any order.
  // Once a review is marked complete it stays complete.
  await tx`
    INSERT INTO sessions (
      date_key, scan_id, research_watchlist, morning_scan, confirmation_complete, confirmation_message,
      published_at, no_confirmed_buys, study_results, results_received_at, is_sample
    ) VALUES (
      ${plan.dateKey}, ${s.scanId ?? null}, ${json(tx, s.researchWatchlist)}, ${json(tx, s.morningScan)},
      ${s.confirmationComplete ?? null}, ${s.confirmationMessage ?? null}, ${s.publishedAt ?? null},
      ${s.noConfirmedBuys ?? null}, ${json(tx, s.studyResults)}, ${s.resultsReceived ? new Date() : null}, ${isSample}
    )
    ON CONFLICT (date_key) DO UPDATE SET
      scan_id = COALESCE(EXCLUDED.scan_id, sessions.scan_id),
      research_watchlist = COALESCE(EXCLUDED.research_watchlist, sessions.research_watchlist),
      morning_scan = COALESCE(EXCLUDED.morning_scan, sessions.morning_scan),
      confirmation_complete = CASE
        WHEN EXCLUDED.confirmation_complete IS NULL THEN sessions.confirmation_complete
        ELSE EXCLUDED.confirmation_complete OR COALESCE(sessions.confirmation_complete, false) END,
      confirmation_message = COALESCE(EXCLUDED.confirmation_message, sessions.confirmation_message),
      published_at = COALESCE(EXCLUDED.published_at, sessions.published_at),
      no_confirmed_buys = COALESCE(EXCLUDED.no_confirmed_buys, sessions.no_confirmed_buys),
      study_results = COALESCE(EXCLUDED.study_results, sessions.study_results),
      results_received_at = COALESCE(EXCLUDED.results_received_at, sessions.results_received_at),
      is_sample = sessions.is_sample AND EXCLUDED.is_sample,
      updated_at = now()`;

  for (const c of plan.candidates) await upsertCandidate(tx, plan.dateKey, c);
}

async function upsertCandidate(tx: Sql, dateKey: string, c: CandidatePatch) {
  const r = c.result;
  await tx`
    INSERT INTO candidates (
      date_key, ticker, name, rank, status_code, status_label, category, entry, stop, target,
      result_status, result_label, result_finalized, execution_price, exit_price, profit_per_share,
      result_basis, execution_basis
    ) VALUES (
      ${dateKey}, ${c.ticker}, ${c.name}, ${c.rank}, ${c.statusCode}, ${c.statusLabel}, ${c.category},
      ${c.entry}, ${c.stop}, ${c.target},
      ${r?.status ?? null}, ${r?.statusLabel ?? null}, ${r ? r.finalized : null}, ${r?.executionPrice ?? null},
      ${r?.exitPrice ?? null}, ${r?.profitPerShare ?? null}, ${r?.resultBasis ?? null}, ${r?.executionBasis ?? null}
    )
    ON CONFLICT (date_key, ticker) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, candidates.name),
      rank = COALESCE(EXCLUDED.rank, candidates.rank),
      status_code = COALESCE(EXCLUDED.status_code, candidates.status_code),
      status_label = COALESCE(EXCLUDED.status_label, candidates.status_label),
      category = COALESCE(EXCLUDED.category, candidates.category),
      entry = COALESCE(EXCLUDED.entry, candidates.entry),
      stop = COALESCE(EXCLUDED.stop, candidates.stop),
      target = COALESCE(EXCLUDED.target, candidates.target),
      result_status = COALESCE(EXCLUDED.result_status, candidates.result_status),
      result_label = COALESCE(EXCLUDED.result_label, candidates.result_label),
      result_finalized = COALESCE(EXCLUDED.result_finalized, candidates.result_finalized),
      execution_price = COALESCE(EXCLUDED.execution_price, candidates.execution_price),
      exit_price = COALESCE(EXCLUDED.exit_price, candidates.exit_price),
      profit_per_share = COALESCE(EXCLUDED.profit_per_share, candidates.profit_per_share),
      result_basis = COALESCE(EXCLUDED.result_basis, candidates.result_basis),
      execution_basis = COALESCE(EXCLUDED.execution_basis, candidates.execution_basis),
      updated_at = now()`;
}

/** Removes everything loaded through "Load sample data". Journal entries are never touched. */
export async function clearSamples(sql: Sql) {
  await sql.begin(async (txRaw) => {
    const tx = txRaw as unknown as Sql;
    await tx`DELETE FROM sessions WHERE is_sample`;
    await tx`DELETE FROM events WHERE source = 'sample'`;
  });
}
