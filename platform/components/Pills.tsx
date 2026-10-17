import type { CandidateRow } from "@/lib/queries";
import { isCompletedResult } from "@/lib/normalize";

const FALLBACK: Record<string, string> = {
  confirmed: "Confirmed",
  watch: "Watch only",
  no_buy: "No buy",
  ungraded: "Ungraded",
};

export function StatusPill({ c }: { c: Pick<CandidateRow, "category" | "statusLabel" | "statusCode"> }) {
  const cat = c.category ?? "other";
  const label = c.statusLabel ?? FALLBACK[cat] ?? c.statusCode ?? "Unknown";
  return (
    <span className={`pill ${cat}`} title={c.statusCode ?? undefined}>
      {label}
    </span>
  );
}

export function ResultPill({ c }: { c: CandidateRow }) {
  if (c.resultFinalized === null && c.resultLabel === null) return <span className="subtle">—</span>;
  const completed = isCompletedResult({ finalized: c.resultFinalized, profitPerShare: c.profitPerShare });
  if (!completed) {
    return <span className="pill neutral">{c.resultLabel ?? "Not finalized"}</span>;
  }
  const tone = c.profitPerShare! > 0 ? "win" : c.profitPerShare! < 0 ? "loss" : "neutral";
  return <span className={`pill ${tone}`}>{c.resultLabel ?? (tone === "win" ? "Winner" : tone === "loss" ? "Loser" : "Flat")}</span>;
}
