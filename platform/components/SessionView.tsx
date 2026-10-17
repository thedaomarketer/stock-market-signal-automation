import Link from "next/link";
import type { CandidateRow, SessionRow } from "@/lib/queries";
import type { PrepRow } from "@/lib/normalize";
import { isCompletedResult } from "@/lib/normalize";
import { price, signed, timeET } from "@/lib/format";
import { ResultPill, StatusPill } from "./Pills";

export function SessionView({
  session,
  candidates,
  journaled,
}: {
  session: SessionRow;
  candidates: CandidateRow[];
  journaled: Set<string>;
}) {
  const confirmed = candidates.filter((c) => c.category === "confirmed");
  const completed = candidates.filter((c) =>
    isCompletedResult({ finalized: c.resultFinalized, profitPerShare: c.profitPerShare }),
  );
  const hasBoard = candidates.length > 0;
  const reviewDone = session.confirmationComplete === true;

  return (
    <div className="stack">
      <Timeline session={session} hasBoard={hasBoard} />

      {session.isSample && (
        <div className="notice warn">
          This session was loaded from fictional sample payloads (DEMO tickers, illustrative prices). Clear it from Setup
          when you connect your real webhook.
        </div>
      )}

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Opening board</h2>
            <p>
              {hasBoard
                ? `${candidates.length} ranked candidates · ${confirmed.length} confirmed${
                    reviewDone ? " · review complete" : " · review in progress"
                  }`
                : reviewDone
                  ? session.confirmationMessage ?? "Completed opening review: no official confirmations."
                  : "Waiting for the opening review (confirmed_buys.created)."}
            </p>
          </div>
          {completed.length > 0 && (
            <span className="subtle">
              Modeled morning results: {completed.filter((c) => c.profitPerShare! > 0).length}W ·{" "}
              {completed.filter((c) => c.profitPerShare! < 0).length}L
            </span>
          )}
        </div>

        {hasBoard ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Ticker</th>
                  <th>Decision</th>
                  <th className="num">Entry</th>
                  <th className="num">Stop</th>
                  <th className="num">Target</th>
                  <th>Morning result</th>
                  <th className="num">Exit</th>
                  <th className="num">P/L per share</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.ticker} className={c.category === "confirmed" ? "is-confirmed" : undefined}>
                    <td className="rank">{c.rank ?? "—"}</td>
                    <td>
                      <div className="ticker">{c.ticker}</div>
                      {c.name && <div className="subtle">{c.name}</div>}
                    </td>
                    <td>
                      <StatusPill c={c} />
                    </td>
                    <td className="num">{price(c.entry)}</td>
                    <td className="num">{price(c.stop)}</td>
                    <td className="num">{price(c.target)}</td>
                    <td>
                      <ResultPill c={c} />
                      {c.resultBasis && <div className="subtle">{c.resultBasis.replaceAll("_", " ")}</div>}
                    </td>
                    <td className="num">{price(c.exitPrice)}</td>
                    <td
                      className={`num ${c.profitPerShare && c.profitPerShare > 0 ? "pos" : c.profitPerShare && c.profitPerShare < 0 ? "neg" : ""}`}
                    >
                      {signed(c.profitPerShare)}
                    </td>
                    <td className="num">
                      {c.category === "confirmed" && c.entry !== null && c.stop !== null && (
                        <span style={{ display: "inline-flex", gap: 6 }}>
                          <Link
                            className="btn small"
                            href={`/risk?entry=${c.entry}&stop=${c.stop}${c.target ? `&target=${c.target}` : ""}&ticker=${c.ticker}`}
                          >
                            Size
                          </Link>
                          <Link
                            className="btn small"
                            href={`/journal?date=${c.dateKey}&ticker=${c.ticker}&fill=${c.entry}`}
                          >
                            {journaled.has(c.ticker) ? "Journaled ✓" : "Log fill"}
                          </Link>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="subtle">No ranked candidates for this session.</p>
        )}
      </section>

      <div className="grid-2">
        <PrepPanel
          title="Research watchlist"
          note="~9:15 AM ET · research only, not official signals"
          rows={session.researchWatchlist}
        />
        <PrepPanel
          title="Morning scan"
          note="~9:28 AM ET · preparation only, not confirmation"
          rows={session.morningScan ? [...session.morningScan.buySignals, ...session.morningScan.watchSignals] : null}
        />
      </div>

      {Array.isArray(session.studyResults) && session.studyResults.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>3 PM study</h2>
              <p>Hypothetical holding comparisons. Excluded from official morning returns.</p>
            </div>
          </div>
          <pre className="json">{JSON.stringify(session.studyResults, null, 2)}</pre>
        </section>
      )}
    </div>
  );
}

function Timeline({ session, hasBoard }: { session: SessionRow; hasBoard: boolean }) {
  const steps = [
    { k: "Research watchlist", done: session.researchWatchlist !== null, v: "Received" },
    { k: "Morning scan", done: session.morningScan !== null, v: "Received" },
    {
      k: "Opening review",
      done: session.confirmationComplete === true || hasBoard,
      v: session.confirmationComplete
        ? `Complete${session.publishedAt ? ` · ${timeET(session.publishedAt)}` : ""}`
        : hasBoard
          ? "In progress"
          : "Waiting",
    },
    {
      k: "Morning results",
      done: session.resultsReceivedAt !== null,
      v: session.resultsReceivedAt ? `Recorded · ${timeET(session.resultsReceivedAt)}` : "Waiting",
    },
  ];
  return (
    <div className="timeline">
      {steps.map((s) => (
        <div key={s.k} className={`step ${s.done ? "done" : "pending"}`}>
          <div className="k">{s.k}</div>
          <div className="v">{s.done ? s.v : "Waiting"}</div>
        </div>
      ))}
    </div>
  );
}

function PrepPanel({ title, note, rows }: { title: string; note: string; rows: PrepRow[] | null }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          <p>{note}</p>
        </div>
      </div>
      {rows === null ? (
        <p className="subtle">Not received.</p>
      ) : rows.length === 0 ? (
        <p className="subtle">Empty list.</p>
      ) : (
        <ul className="prep-list">
          {rows.map((r) => (
            <li key={r.ticker}>
              <span>
                <span className="ticker">{r.ticker}</span> {r.name && <span className="subtle">{r.name}</span>}
              </span>
              <span className="subtle">
                {price(r.entry)} / {price(r.stop)} / {price(r.target)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
