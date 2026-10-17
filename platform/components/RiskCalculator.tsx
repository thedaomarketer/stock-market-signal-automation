"use client";

import { useEffect, useState } from "react";
import { sizePosition } from "@/lib/risk";
import { money, price } from "@/lib/format";

const STORE_KEY = "signal-desk.risk-defaults";

export function RiskCalculator({ initial }: { initial: { entry: string; stop: string; target: string; ticker: string } }) {
  const [cash, setCash] = useState("5000");
  const [risk, setRisk] = useState("1");
  const [entry, setEntry] = useState(initial.entry);
  const [stop, setStop] = useState(initial.stop);
  const [target, setTarget] = useState(initial.target);

  // Remember account size and risk % on this device only.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null");
      if (saved?.cash) setCash(saved.cash);
      if (saved?.risk) setRisk(saved.risk);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ cash, risk }));
    } catch {}
  }, [cash, risk]);

  const r = sizePosition({
    cash: Number(cash),
    riskPercent: Number(risk),
    entry: Number(entry),
    stop: Number(stop),
    target: target ? Number(target) : null,
  });

  const field = (id: string, label: string, value: string, set: (v: string) => void) => (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" step="any" min="0" value={value} onChange={(e) => set(e.target.value)} />
    </div>
  );

  return (
    <div className="grid-2">
      <section className="panel">
        <div className="panel-head">
          <h2>Inputs{initial.ticker && <span className="ticker"> · {initial.ticker}</span>}</h2>
        </div>
        <div className="form-grid">
          {field("cash", "Account cash ($)", cash, setCash)}
          {field("risk", "Risk per trade (%)", risk, setRisk)}
          {field("entry", "Entry", entry, setEntry)}
          {field("stop", "Stop", stop, setStop)}
          {field("target", "Target (optional)", target, setTarget)}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>Size</h2>
        </div>
        {r ? (
          <>
            <div className="tiles" style={{ marginBottom: 12 }}>
              <div className="tile">
                <div className="label">Shares</div>
                <div className="value">{r.shares}</div>
              </div>
              <div className="tile">
                <div className="label">Position cost</div>
                <div className="value">{money(r.positionCost)}</div>
              </div>
            </div>
            <dl className="kv">
              <dt>Planned risk</dt>
              <dd>{money(r.plannedRiskDollars)}</dd>
              <dt>Risk per share</dt>
              <dd>{price(r.riskPerShare)}</dd>
              <dt>Risk if stopped</dt>
              <dd className="neg">{money(r.actualRiskDollars)}</dd>
              {r.rewardDollars !== null && (
                <>
                  <dt>Reward at target</dt>
                  <dd className="pos">{money(r.rewardDollars)}</dd>
                  <dt>Reward : risk</dt>
                  <dd>{r.rewardToRisk?.toFixed(2)} : 1</dd>
                </>
              )}
            </dl>
            {r.cappedByCash && (
              <p className="notice warn" style={{ marginTop: 12, marginBottom: 0 }}>
                Capped by available cash. The risk budget alone would allow more shares.
              </p>
            )}
            <p className="subtle" style={{ marginTop: 12 }}>
              Ignores slippage, gaps and fees. A stop is not guaranteed to fill at its price.
            </p>
          </>
        ) : (
          <p className="subtle">Enter positive numbers with the stop below the entry.</p>
        )}
      </section>
    </div>
  );
}
