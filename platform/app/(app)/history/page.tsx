import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { listSessionSummaries } from "@/lib/queries";
import { longDate, signed } from "@/lib/format";
import { requireAuth } from "@/lib/session";

export const metadata: Metadata = { title: "History" };

export default async function HistoryPage() {
  await requireAuth();
  const sessions = await listSessionSummaries(db());

  const totals = sessions.reduce(
    (t, s) => ({
      confirmed: t.confirmed + s.confirmed,
      completed: t.completed + s.completed,
      winners: t.winners + s.winners,
      losers: t.losers + s.losers,
      noConfirm: t.noConfirm + (s.confirmationComplete && s.confirmed === 0 ? 1 : 0),
      pps: t.pps + (s.profitPerShareSum ?? 0),
    }),
    { confirmed: 0, completed: 0, winners: 0, losers: 0, noConfirm: 0, pps: 0 },
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>History</h1>
          <p>Every session received, with recorded morning outcomes, losses included.</p>
        </div>
      </div>

      <div className="tiles">
        <div className="tile">
          <div className="label">Sessions</div>
          <div className="value">{sessions.length}</div>
          <div className="sub">{totals.noConfirm} with no confirmations</div>
        </div>
        <div className="tile">
          <div className="label">Confirmed signals</div>
          <div className="value">{totals.confirmed}</div>
          <div className="sub">{totals.completed} with finalized results</div>
        </div>
        <div className="tile">
          <div className="label">Winners / losers</div>
          <div className="value">
            <span className="pos">{totals.winners}</span> / <span className="neg">{totals.losers}</span>
          </div>
          <div className="sub">modeled, not broker fills</div>
        </div>
        <div className="tile">
          <div className="label">Sum P/L per share</div>
          <div className={`value ${totals.pps > 0 ? "pos" : totals.pps < 0 ? "neg" : ""}`}>{signed(totals.pps)}</div>
          <div className="sub">unweighted, 1 share each</div>
        </div>
      </div>

      <section className="panel">
        {sessions.length === 0 ? (
          <p className="subtle">No sessions yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Review</th>
                  <th className="num">Candidates</th>
                  <th className="num">Confirmed</th>
                  <th className="num">W</th>
                  <th className="num">L</th>
                  <th className="num">P/L per share</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.dateKey}>
                    <td>
                      <Link href={`/history/${s.dateKey}`}>{longDate(s.dateKey)}</Link>
                      {s.isSample && <span className="pill sample" style={{ marginLeft: 8 }}>Sample</span>}
                    </td>
                    <td>
                      {s.confirmationComplete ? (
                        <span className="pill neutral">Complete</span>
                      ) : (
                        <span className="subtle">Incomplete</span>
                      )}
                    </td>
                    <td className="num">{s.candidates}</td>
                    <td className="num">{s.confirmed}</td>
                    <td className="num pos">{s.winners || ""}</td>
                    <td className="num neg">{s.losers || ""}</td>
                    <td
                      className={`num ${s.profitPerShareSum && s.profitPerShareSum > 0 ? "pos" : s.profitPerShareSum && s.profitPerShareSum < 0 ? "neg" : ""}`}
                    >
                      {signed(s.profitPerShareSum)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
