import { describe, expect, it } from "vitest";
import { categorize, isCompletedResult, normalize } from "@/lib/normalize";
import research from "@/samples/research-watchlist.json";
import morning from "@/samples/morning-scan.json";
import confirmed from "@/samples/confirmed-buys.json";
import results from "@/samples/quick-exit-results.json";
import noPicks from "@/samples/no-picks.json";
import test from "@/samples/webhook-test.json";

describe("categorize", () => {
  it("maps member labels", () => {
    expect(categorize("Confirmed buy", "confirmed_buy")).toBe("confirmed");
    expect(categorize("Watch only", "wait_for_reclaim")).toBe("watch");
    expect(categorize("No buy", "failed_confirmation")).toBe("no_buy");
    expect(categorize("Ungraded", "quote_unavailable")).toBe("ungraded");
  });

  it("does not invent mappings for unknown labels or codes", () => {
    expect(categorize("Something new", "new_code")).toBe("other");
    expect(categorize(null, "failed_confirmation")).toBe("other");
    expect(categorize(null, null)).toBeNull();
  });
});

describe("normalize", () => {
  it("keeps research and morning scan as prep only (no candidates)", () => {
    const r = normalize(research);
    expect(r.dateKey).toBe("2026-10-08");
    expect(r.candidates).toEqual([]);
    expect(r.session?.researchWatchlist?.map((x) => x.ticker)).toEqual(["DEMOA", "DEMOB"]);

    const m = normalize(morning);
    expect(m.candidates).toEqual([]);
    expect(m.session?.morningScan?.buySignals).toHaveLength(2);
  });

  it("builds all eight ranked candidates from confirmed_buys, with status before rank", () => {
    const plan = normalize(confirmed);
    expect(plan.candidates).toHaveLength(8);
    const byTicker = Object.fromEntries(plan.candidates.map((c) => [c.ticker, c]));
    expect(byTicker.DEMO1).toMatchObject({ rank: 1, category: "watch", entry: null });
    expect(byTicker.DEMOA).toMatchObject({ rank: 2, category: "confirmed", entry: 20, stop: 19.5, target: 20.5 });
    expect(byTicker.DEMO7).toMatchObject({ rank: 7, category: "ungraded", statusCode: "quote_unavailable" });
    expect(plan.session).toMatchObject({ confirmationComplete: false, scanId: "2026-10-08_morning" });
  });

  it("handles a completed review with no confirmations", () => {
    const plan = normalize(noPicks);
    expect(plan.candidates).toEqual([]);
    expect(plan.session).toMatchObject({
      confirmationComplete: true,
      confirmationMessage: "Completed opening review: no official confirmations.",
    });
  });

  it("treats confirmedBuys rows without openingConfirmation as confirmed", () => {
    const plan = normalize({
      event: "confirmed_buys.created",
      dateKey: "2026-10-09",
      data: { confirmedBuys: [{ ticker: "DEMOZ", entry: 10, stop: 9.5, target: 10.5 }] },
    });
    expect(plan.candidates[0]).toMatchObject({ ticker: "DEMOZ", category: "confirmed", statusLabel: "Confirmed buy" });
  });

  it("extracts modeled morning results", () => {
    const plan = normalize(results);
    expect(plan.session?.resultsReceived).toBe(true);
    const a = plan.candidates.find((c) => c.ticker === "DEMOA")!;
    expect(a.result).toMatchObject({ finalized: true, exitPrice: 20.5, profitPerShare: 0.5, statusLabel: "Winner" });
    const b = plan.candidates.find((c) => c.ticker === "DEMOB")!;
    expect(b.result).toMatchObject({ profitPerShare: -1, resultBasis: "stop_first" });
  });

  it("logs test and unknown events without session changes", () => {
    expect(normalize(test)).toMatchObject({ event: "webhook.test", session: null, candidates: [] });
    expect(normalize({ event: "something.else", dateKey: "2026-10-08" }).session).toBeNull();
  });

  it("drops session changes when dateKey is missing or malformed", () => {
    const plan = normalize({ ...confirmed, dateKey: "10/08/2026" });
    expect(plan.dateKey).toBeNull();
    expect(plan.candidates).toEqual([]);
  });

  it("falls back to the event header when the body has no event", () => {
    expect(normalize({ dateKey: "2026-10-08", data: {} }, "webhook.test").event).toBe("webhook.test");
  });
});

describe("isCompletedResult", () => {
  it("requires finalized with a numeric return", () => {
    expect(isCompletedResult({ finalized: true, profitPerShare: 0 })).toBe(true);
    expect(isCompletedResult({ finalized: false, profitPerShare: 1 })).toBe(false);
    expect(isCompletedResult({ finalized: true, profitPerShare: null })).toBe(false);
  });
});
