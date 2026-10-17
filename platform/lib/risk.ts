// Generic sizing arithmetic (same math as examples/risk-sizing-calculator). Not an account recommendation.

export type RiskInput = { cash: number; riskPercent: number; entry: number; stop: number; target?: number | null };

export type RiskResult = {
  plannedRiskDollars: number;
  riskPerShare: number;
  shares: number;
  positionCost: number;
  actualRiskDollars: number;
  rewardDollars: number | null;
  rewardToRisk: number | null;
  cappedByCash: boolean;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function sizePosition({ cash, riskPercent, entry, stop, target }: RiskInput): RiskResult | null {
  if (![cash, riskPercent, entry, stop].every((n) => Number.isFinite(n) && n > 0)) return null;
  const riskPerShare = entry - stop;
  if (riskPerShare <= 0) return null;

  const plannedRiskDollars = cash * (riskPercent / 100);
  const byRisk = Math.floor(plannedRiskDollars / riskPerShare);
  const byCash = Math.floor(cash / entry);
  const shares = Math.max(Math.min(byRisk, byCash), 0);
  const hasTarget = typeof target === "number" && Number.isFinite(target) && target > entry;

  return {
    plannedRiskDollars: round2(plannedRiskDollars),
    riskPerShare: round2(riskPerShare),
    shares,
    positionCost: round2(shares * entry),
    actualRiskDollars: round2(shares * riskPerShare),
    rewardDollars: hasTarget ? round2(shares * (target! - entry)) : null,
    rewardToRisk: hasTarget ? round2((target! - entry) / riskPerShare) : null,
    cappedByCash: byCash < byRisk,
  };
}

/** Realized P&L for a journal row; null while the position is open. */
export function journalPnl(e: { shares: number; fillPrice: number; exitPrice: number | null; fees: number }) {
  if (e.exitPrice === null) return null;
  return round2((e.exitPrice - e.fillPrice) * e.shares - e.fees);
}
