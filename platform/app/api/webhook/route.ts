import { db } from "@/lib/db";
import { isRecentTimestamp, verifySignature } from "@/lib/signature";
import { ingest } from "@/lib/store";

const MAX_BODY_BYTES = 1_000_000;
const SELFTEST_PREFIX = "selftest-";

export async function POST(req: Request) {
  const secret = process.env.KAMDENAI_SIGNING_SECRET;
  if (!secret) return Response.json({ error: "signing_secret_not_configured" }, { status: 503 });

  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY_BYTES) return Response.json({ error: "payload_too_large" }, { status: 413 });

  const timestamp = req.headers.get("x-kamdenai-timestamp");
  if (!isRecentTimestamp(timestamp)) return Response.json({ error: "stale_timestamp" }, { status: 401 });

  const signature = req.headers.get("x-kamdenai-signature");
  if (!verifySignature({ rawBody, timestamp, signature, secret })) {
    return Response.json({ error: "invalid_signature" }, { status: 401 });
  }

  try {
    JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    const deliveryId = req.headers.get("x-kamdenai-delivery");
    const outcome = await ingest(db(), {
      rawBody,
      deliveryId,
      headerEvent: req.headers.get("x-kamdenai-event"),
      // scripts/send-samples.mjs tags its deliveries so "Clear sample data" removes them too.
      source: deliveryId?.startsWith(SELFTEST_PREFIX) ? "sample" : "webhook",
    });
    return Response.json({ ok: true, ...outcome });
  } catch (err) {
    // A 5xx lets KamdenAI retry; the delivery id keeps the retry from double-applying.
    console.error("webhook ingest failed", err);
    return Response.json({ error: "ingest_failed" }, { status: 500 });
  }
}
