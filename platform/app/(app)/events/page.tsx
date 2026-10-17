import type { Metadata } from "next";
import { db } from "@/lib/db";
import { dateTimeET } from "@/lib/format";
import { listEvents } from "@/lib/queries";
import { requireAuth } from "@/lib/session";

export const metadata: Metadata = { title: "Event log" };

export default async function EventsPage() {
  await requireAuth();
  const events = await listEvents(db());

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Event log</h1>
          <p>The last {events.length || 100} deliveries, stored exactly as received after the signature check passed.</p>
        </div>
      </div>
      <section className="panel">
        {events.length === 0 ? (
          <p className="subtle">No deliveries yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Received</th>
                  <th>Event</th>
                  <th>Session</th>
                  <th>Source</th>
                  <th>Delivery</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{dateTimeET(e.receivedAt)}</td>
                    <td>
                      <details>
                        <summary>
                          <code>{e.event}</code>
                        </summary>
                        <pre className="json">{JSON.stringify(e.payload, null, 2)}</pre>
                      </details>
                    </td>
                    <td>{e.dateKey ?? "—"}</td>
                    <td>
                      <span className={`pill ${e.source === "sample" ? "sample" : "neutral"}`}>{e.source}</span>
                    </td>
                    <td className="subtle">
                      <code>{e.deliveryId.length > 24 ? `${e.deliveryId.slice(0, 24)}…` : e.deliveryId}</code>
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
