import type { Metadata } from "next";
import Link from "next/link";
import { closeJournalEntry, removeJournalEntry } from "@/app/actions";
import { JournalForm } from "@/components/JournalForm";
import { db } from "@/lib/db";
import { money, price } from "@/lib/format";
import { listJournal } from "@/lib/queries";
import { journalPnl } from "@/lib/risk";
import { requireAuth, todayKeyET } from "@/lib/session";

export const metadata: Metadata = { title: "Journal" };

type Search = Promise<{ date?: string; ticker?: string; fill?: string }>;

export default async function JournalPage({ searchParams }: { searchParams: Search }) {
  await requireAuth();
  const sp = await searchParams;
  const entries = await listJournal(db());

  const closed = entries.filter((e) => e.exitPrice !== null);
  const pnls = closed.map((e) => journalPnl(e)!);
  const realized = pnls.reduce((a, b) => a + b, 0);
  const wins = pnls.filter((p) => p > 0).length;
  const losses = pnls.filter((p) => p < 0).length;

  const defaults = {
    dateKey: sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayKeyET(),
    ticker: (sp.ticker ?? "").slice(0, 12),
    fill: sp.fill && Number.isFinite(Number(sp.fill)) ? sp.fill : "",
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Journal</h1>
          <p>Your own broker fills and exits. Kept separate from KamdenAI&apos;s published records.</p>
        </div>
      </div>

      <div className="tiles">
        <div className="tile">
          <div className="label">Open positions</div>
          <div className="value">{entries.length - closed.length}</div>
        </div>
        <div className="tile">
          <div className="label">Closed trades</div>
          <div className="value">{closed.length}</div>
          <div className="sub">
            {wins}W · {losses}L
          </div>
        </div>
        <div className="tile">
          <div className="label">Realized P&amp;L</div>
          <div className={`value ${realized > 0 ? "pos" : realized < 0 ? "neg" : ""}`}>{money(realized)}</div>
          <div className="sub">net of fees you entered</div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Log a fill</h2>
        </div>
        <JournalForm key={`${defaults.dateKey}-${defaults.ticker}`} defaults={defaults} />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Entries</h2>
        </div>
        {entries.length === 0 ? (
          <p className="subtle">Nothing logged yet. Use “Log fill” on a confirmed signal, or the form above.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Ticker</th>
                  <th className="num">Shares</th>
                  <th className="num">Fill</th>
                  <th className="num">Exit</th>
                  <th className="num">Fees</th>
                  <th className="num">P&amp;L</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const pnl = journalPnl(e);
                  return (
                    <tr key={e.id}>
                      <td>
                        <Link href={`/history/${e.dateKey}`}>{e.dateKey}</Link>
                      </td>
                      <td className="ticker">{e.ticker}</td>
                      <td className="num">{e.shares}</td>
                      <td className="num">{price(e.fillPrice)}</td>
                      <td className="num">
                        {e.exitPrice !== null ? (
                          price(e.exitPrice)
                        ) : (
                          <form action={closeJournalEntry} className="inline-form">
                            <input type="hidden" name="id" value={e.id} />
                            <input name="exitPrice" type="number" step="any" min="0" placeholder="Exit" required aria-label="Exit price" />
                            <button className="btn small" type="submit">
                              Close
                            </button>
                          </form>
                        )}
                      </td>
                      <td className="num">{e.fees ? money(e.fees) : "—"}</td>
                      <td className={`num ${pnl && pnl > 0 ? "pos" : pnl && pnl < 0 ? "neg" : ""}`}>
                        {pnl === null ? <span className="pill neutral">Open</span> : money(pnl)}
                      </td>
                      <td className="subtle" style={{ maxWidth: 260 }}>
                        {e.notes}
                      </td>
                      <td className="num">
                        <form action={removeJournalEntry}>
                          <input type="hidden" name="id" value={e.id} />
                          <button className="btn small ghost danger" type="submit" aria-label={`Delete ${e.ticker} entry`}>
                            Delete
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
