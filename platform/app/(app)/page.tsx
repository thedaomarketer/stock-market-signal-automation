import { db } from "@/lib/db";
import { getCandidates, getLatestSession, journalTickersForDate } from "@/lib/queries";
import { longDate } from "@/lib/format";
import { requireAuth, todayKeyET } from "@/lib/session";
import { SessionView } from "@/components/SessionView";
import { LoadSampleButton } from "@/components/SampleButtons";
import Link from "next/link";

export default async function TodayPage() {
  await requireAuth();
  const today = todayKeyET();
  const sql = db();
  const session = await getLatestSession(sql, today);

  if (!session) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Today</h1>
            <p>{longDate(today)}</p>
          </div>
        </div>
        <section className="panel empty">
          <h2>No signal events yet</h2>
          <p>
            Point your KamdenAI developer webhook at this app and the opening board will appear here each morning.
            <br />
            Want to look around first? Load the fictional sample session.
          </p>
          <div className="actions">
            <LoadSampleButton />
            <Link className="btn" href="/setup">
              Webhook setup
            </Link>
          </div>
        </section>
      </>
    );
  }

  const [candidates, journaled] = await Promise.all([
    getCandidates(sql, session.dateKey),
    journalTickersForDate(sql, session.dateKey),
  ]);
  const isToday = session.dateKey === today;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{isToday ? "Today" : "Latest session"}</h1>
          <p>
            {longDate(session.dateKey)}
            {session.isSample && <span className="pill sample" style={{ marginLeft: 8 }}>Sample</span>}
          </p>
        </div>
      </div>
      {!isToday && (
        <div className="notice">
          Nothing received yet for {longDate(today)}. Showing the most recent session.
        </div>
      )}
      <SessionView session={session} candidates={candidates} journaled={journaled} />
    </>
  );
}
