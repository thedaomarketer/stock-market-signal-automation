import type { Metadata } from "next";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { ClearSampleButton, LoadSampleButton } from "@/components/SampleButtons";

export const metadata: Metadata = { title: "Setup" };

async function databaseStatus() {
  try {
    const [row] = await db()<{ n: number }[]>`SELECT count(*)::int AS n FROM schema_migrations`;
    return { ok: true, detail: `connected · ${row.n} migration(s) applied` };
  } catch {
    return { ok: false, detail: "not reachable, or migrations not applied (run npm run db:migrate)" };
  }
}

export default async function SetupPage() {
  await requireAuth();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "your-app.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const webhookUrl = `${proto}://${host}/api/webhook`;
  const dbStatus = await databaseStatus();

  const checks = [
    { name: "DATABASE_URL", ok: dbStatus.ok, detail: dbStatus.detail },
    {
      name: "KAMDENAI_SIGNING_SECRET",
      ok: Boolean(process.env.KAMDENAI_SIGNING_SECRET),
      detail: process.env.KAMDENAI_SIGNING_SECRET ? "set" : "missing, so every delivery is rejected (503)",
    },
    { name: "DASHBOARD_PASSWORD", ok: Boolean(process.env.DASHBOARD_PASSWORD), detail: "set" },
    { name: "SESSION_SECRET", ok: (process.env.SESSION_SECRET ?? "").length >= 32, detail: "set (32+ characters)" },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Setup</h1>
          <p>Connect your KamdenAI developer webhook and check the configuration.</p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>1. Webhook endpoint</h2>
            <p>Paste this URL into KamdenAI → Developer webhooks, then copy the signing secret it gives you.</p>
          </div>
        </div>
        <div className="copy">{webhookUrl}</div>
        <p className="subtle" style={{ marginTop: 10 }}>
          Subscribe to <code>research_watchlist.created</code>, <code>morning_scan.created</code>,{" "}
          <code>confirmed_buys.created</code> and <code>quick_exit_results.created</code>. Deliveries must carry a valid{" "}
          <code>X-KamdenAI-Signature</code> (HMAC-SHA256 of <code>timestamp.rawBody</code>) and a timestamp within 5
          minutes. Repeated <code>X-KamdenAI-Delivery</code> ids are acknowledged once and never applied twice.
        </p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>2. Environment</h2>
            <p>Set these in Vercel → Project → Settings → Environment Variables, then redeploy.</p>
          </div>
        </div>
        <dl className="kv">
          {checks.map((c) => (
            <div key={c.name} style={{ display: "contents" }}>
              <dt>
                <code>{c.name}</code>
              </dt>
              <dd className={c.ok ? "pos" : "neg"}>{c.ok ? `✓ ${c.detail}` : `✗ ${c.name === "DATABASE_URL" ? c.detail : "missing"}`}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>3. Test the endpoint</h2>
            <p>Sends the fictional sample events with a real signature, exactly like KamdenAI would.</p>
          </div>
        </div>
        <pre className="json">{`cd platform
KAMDENAI_SIGNING_SECRET=<same secret> npm run send-samples -- ${webhookUrl}`}</pre>
        <p className="subtle">KamdenAI&apos;s own test event (webhook.test) shows up in the Event log only.</p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Sample data</h2>
            <p>Load a fictional session to explore the dashboard. Clearing it never touches real sessions or your journal.</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <LoadSampleButton />
          <ClearSampleButton />
        </div>
      </section>
    </>
  );
}
