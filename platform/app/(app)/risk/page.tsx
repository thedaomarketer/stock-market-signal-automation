import type { Metadata } from "next";
import { RiskCalculator } from "@/components/RiskCalculator";
import { requireAuth } from "@/lib/session";

export const metadata: Metadata = { title: "Risk sizing" };

type Search = Promise<{ entry?: string; stop?: string; target?: string; ticker?: string }>;

const numParam = (v: string | undefined, fallback: string) => (v && Number.isFinite(Number(v)) ? v : fallback);

export default async function RiskPage({ searchParams }: { searchParams: Search }) {
  await requireAuth();
  const sp = await searchParams;
  const initial = {
    entry: numParam(sp.entry, "24.5"),
    stop: numParam(sp.stop, "23.95"),
    target: numParam(sp.target, ""),
    ticker: (sp.ticker ?? "").slice(0, 12),
  };
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Risk sizing</h1>
          <p>Generic sizing arithmetic. You choose your own size and exposure. This is not an account recommendation.</p>
        </div>
      </div>
      <RiskCalculator key={JSON.stringify(initial)} initial={initial} />
    </>
  );
}
