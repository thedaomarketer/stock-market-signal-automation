import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCandidates, getSession, journalTickersForDate } from "@/lib/queries";
import { longDate } from "@/lib/format";
import { requireAuth } from "@/lib/session";
import { SessionView } from "@/components/SessionView";

export default async function SessionPage({ params }: { params: Promise<{ date: string }> }) {
  await requireAuth();
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const sql = db();
  const session = await getSession(sql, date);
  if (!session) notFound();
  const [candidates, journaled] = await Promise.all([getCandidates(sql, date), journalTickersForDate(sql, date)]);

  return (
    <>
      <div className="page-head">
        <div>
          <p>
            <Link href="/history">← History</Link>
          </p>
          <h1>{longDate(date)}</h1>
        </div>
      </div>
      <SessionView session={session} candidates={candidates} journaled={journaled} />
    </>
  );
}
