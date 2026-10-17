// Signs the sample payloads and POSTs them to a webhook URL, the way KamdenAI does.
// Usage: KAMDENAI_SIGNING_SECRET=... node scripts/send-samples.mjs https://your-app.vercel.app/api/webhook
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const url = process.argv[2];
const secret = process.env.KAMDENAI_SIGNING_SECRET;
if (!url || !secret) {
  console.error("Usage: KAMDENAI_SIGNING_SECRET=... npm run send-samples -- <webhook url>");
  process.exit(1);
}

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "samples");
const files = ["webhook-test.json", "research-watchlist.json", "morning-scan.json", "confirmed-buys.json", "quick-exit-results.json"];

for (const file of files) {
  const body = fs.readFileSync(path.join(dir, file), "utf8");
  const payload = JSON.parse(body);
  const timestamp = String(Date.now());
  const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-KamdenAI-Event": payload.event,
      "X-KamdenAI-Delivery": `selftest-${file}-${crypto.createHash("sha256").update(body).digest("hex").slice(0, 12)}`,
      "X-KamdenAI-Timestamp": timestamp,
      "X-KamdenAI-Signature": signature,
    },
    body,
  });
  console.log(`${res.status} ${payload.event} ${await res.text()}`);
}
