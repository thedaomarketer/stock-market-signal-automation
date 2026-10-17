import { describe, expect, it } from "vitest";
import { checkPassword, createSessionToken, SESSION_TTL_SECONDS, verifySessionToken } from "@/lib/auth";
import { journalPnl, sizePosition } from "@/lib/risk";

const secret = "s".repeat(32);

describe("session tokens", () => {
  it("round-trips", async () => {
    expect(await verifySessionToken(await createSessionToken(secret), secret)).toBe(true);
  });

  it("rejects expired, tampered, wrong-secret and missing tokens", async () => {
    const now = Date.now();
    const token = await createSessionToken(secret, now);
    expect(await verifySessionToken(token, secret, now + (SESSION_TTL_SECONDS + 5) * 1000)).toBe(false);
    const [exp, sig] = token.split(".");
    expect(await verifySessionToken(`${Number(exp) + 999}.${sig}`, secret)).toBe(false);
    expect(await verifySessionToken(token, "x".repeat(32))).toBe(false);
    expect(await verifySessionToken(undefined, secret)).toBe(false);
    expect(await verifySessionToken(token, null)).toBe(false);
  });
});

describe("checkPassword", () => {
  it("matches only the configured password", async () => {
    expect(await checkPassword("hunter2-long-pass", "hunter2-long-pass", secret)).toBe(true);
    expect(await checkPassword("hunter2", "hunter2-long-pass", secret)).toBe(false);
    expect(await checkPassword("anything", undefined, secret)).toBe(false);
    expect(await checkPassword("", "", secret)).toBe(false);
  });
});

describe("sizePosition", () => {
  it("matches the CLI example's defaults", () => {
    expect(sizePosition({ cash: 5000, riskPercent: 1, entry: 24.5, stop: 23.95 })).toMatchObject({
      plannedRiskDollars: 50,
      riskPerShare: 0.55,
      shares: 90,
      positionCost: 2205,
      cappedByCash: false,
    });
  });

  it("caps shares by available cash", () => {
    const r = sizePosition({ cash: 1000, riskPercent: 5, entry: 20, stop: 19.95 })!;
    expect(r.shares).toBe(50);
    expect(r.cappedByCash).toBe(true);
  });

  it("reports reward to risk when a target is given", () => {
    expect(sizePosition({ cash: 5000, riskPercent: 1, entry: 20, stop: 19.5, target: 20.5 })).toMatchObject({
      shares: 100,
      rewardDollars: 50,
      rewardToRisk: 1,
    });
  });

  it("returns null for invalid input", () => {
    expect(sizePosition({ cash: 5000, riskPercent: 1, entry: 20, stop: 21 })).toBeNull();
    expect(sizePosition({ cash: 0, riskPercent: 1, entry: 20, stop: 19 })).toBeNull();
    expect(sizePosition({ cash: 5000, riskPercent: NaN, entry: 20, stop: 19 })).toBeNull();
  });
});

describe("journalPnl", () => {
  it("computes realized P&L net of fees", () => {
    expect(journalPnl({ shares: 100, fillPrice: 20.02, exitPrice: 20.5, fees: 1 })).toBe(47);
    expect(journalPnl({ shares: 100, fillPrice: 20, exitPrice: null, fees: 0 })).toBeNull();
  });
});
