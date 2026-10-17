// Integration tests against a real Postgres. Set TEST_DATABASE_URL to run them;
// the database is wiped, so point it at a throwaway database.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createSql, type Sql } from "@/lib/db";
import { clearSamples, ingest } from "@/lib/store";
import {
  addJournalEntry,
  getCandidates,
  getLatestSession,
  getSession,
  listEvents,
  listJournal,
  listSessionSummaries,
} from "@/lib/queries";
// @ts-expect-error untyped .mjs helper
import { migrate } from "@/scripts/migrate.mjs";
import research from "@/samples/research-watchlist.json";
import confirmed from "@/samples/confirmed-buys.json";
import results from "@/samples/quick-exit-results.json";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("store (Postgres)", () => {
  let sql: Sql;
  const send = (payload: unknown, deliveryId: string | null, source: "webhook" | "sample" = "webhook") =>
    ingest(sql, { rawBody: JSON.stringify(payload), deliveryId, headerEvent: null, source });

  beforeAll(async () => {
    sql = createSql(url!);
    await sql.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await migrate(sql);
  });
  afterAll(() => sql?.end());
  beforeEach(() => sql.unsafe("TRUNCATE events, sessions, candidates, journal_entries RESTART IDENTITY CASCADE"));

  it("builds a session from the morning events", async () => {
    await send(research, "d1");
    await send(confirmed, "d2");
    await send(results, "d3");

    const session = await getSession(sql, "2026-10-08");
    expect(session?.researchWatchlist).toHaveLength(2);
    expect(session?.confirmationComplete).toBe(false);
    expect(session?.resultsReceivedAt).toBeInstanceOf(Date);

    const cands = await getCandidates(sql, "2026-10-08");
    expect(cands.map((c) => c.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const a = cands.find((c) => c.ticker === "DEMOA")!;
    expect(a).toMatchObject({ category: "confirmed", entry: 20, profitPerShare: 0.5, resultFinalized: true });
    // Result event didn't wipe the opening decision for non-confirmed names.
    expect(cands.find((c) => c.ticker === "DEMO1")).toMatchObject({ category: "watch", profitPerShare: null });
  });

  it("ignores a repeated delivery id", async () => {
    expect((await send(confirmed, "same")).duplicate).toBe(false);
    expect((await send(confirmed, "same")).duplicate).toBe(true);
    expect(await listEvents(sql)).toHaveLength(1);
  });

  it("dedupes by body hash when no delivery id is sent", async () => {
    await send(confirmed, null);
    expect((await send(confirmed, null)).duplicate).toBe(true);
  });

  it("handles results arriving before confirmations", async () => {
    await send(results, "r");
    await send(confirmed, "c");
    const cands = await getCandidates(sql, "2026-10-08");
    expect(cands).toHaveLength(8);
    expect(cands.find((c) => c.ticker === "DEMOB")).toMatchObject({ rank: 5, profitPerShare: -1 });
  });

  it("keeps a completed review complete", async () => {
    await send({ ...confirmed, data: { ...confirmed.data, confirmationComplete: true } }, "a");
    await send(confirmed, "b"); // replays confirmationComplete: false
    expect((await getSession(sql, "2026-10-08"))?.confirmationComplete).toBe(true);
  });

  it("summarizes sessions and finds the latest one", async () => {
    await send(confirmed, "c");
    await send(results, "r");
    const [s] = await listSessionSummaries(sql);
    expect(s).toMatchObject({ dateKey: "2026-10-08", candidates: 8, confirmed: 2, completed: 2, winners: 1, losers: 1 });
    expect(s.profitPerShareSum).toBeCloseTo(-0.5);
    expect((await getLatestSession(sql, "2026-10-17"))?.dateKey).toBe("2026-10-08");
    expect(await getLatestSession(sql, "2026-10-01")).toBeNull();
  });

  it("clears sample data but keeps real sessions and the journal", async () => {
    await send(confirmed, "sample-1", "sample");
    await send({ ...confirmed, dateKey: "2026-10-09" }, "real-1");
    await addJournalEntry(sql, {
      dateKey: "2026-10-08", ticker: "DEMOA", shares: 10, fillPrice: 20, exitPrice: null, fees: 0, notes: null,
    });
    await clearSamples(sql);
    expect(await getSession(sql, "2026-10-08")).toBeNull();
    expect(await getSession(sql, "2026-10-09")).not.toBeNull();
    expect(await listJournal(sql)).toHaveLength(1);
  });

  it("a real delivery for a sample date makes the session real", async () => {
    await send(confirmed, "s", "sample");
    await send(results, "real");
    expect((await getSession(sql, "2026-10-08"))?.isSample).toBe(false);
  });
});
