import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { isRecentTimestamp, verifySignature } from "@/lib/signature";

const secret = "whsec_test";
const body = '{"event":"webhook.test"}';

function sign(timestamp: string, raw: string, key = secret) {
  return crypto.createHmac("sha256", key).update(`${timestamp}.${raw}`).digest("hex");
}

describe("verifySignature", () => {
  it("accepts a valid HMAC of timestamp.rawBody", () => {
    const ts = String(Date.now());
    expect(verifySignature({ rawBody: body, timestamp: ts, signature: sign(ts, body), secret })).toBe(true);
  });

  it("rejects a modified body", () => {
    const ts = String(Date.now());
    expect(
      verifySignature({ rawBody: body + " ", timestamp: ts, signature: sign(ts, body), secret }),
    ).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    const ts = String(Date.now());
    expect(
      verifySignature({ rawBody: body, timestamp: ts, signature: sign(ts, body, "other"), secret }),
    ).toBe(false);
  });

  it("rejects missing or malformed signatures without throwing", () => {
    const ts = String(Date.now());
    expect(verifySignature({ rawBody: body, timestamp: ts, signature: null, secret })).toBe(false);
    expect(verifySignature({ rawBody: body, timestamp: ts, signature: "zz", secret })).toBe(false);
    expect(verifySignature({ rawBody: body, timestamp: null, signature: "ab", secret })).toBe(false);
  });

  it("accepts an optional sha256= prefix", () => {
    const ts = String(Date.now());
    expect(
      verifySignature({ rawBody: body, timestamp: ts, signature: `sha256=${sign(ts, body)}`, secret }),
    ).toBe(true);
  });
});

describe("isRecentTimestamp", () => {
  const now = Date.parse("2026-10-08T13:30:00Z");

  it("accepts millisecond timestamps within 5 minutes", () => {
    expect(isRecentTimestamp(String(now - 4 * 60_000), now)).toBe(true);
  });

  it("accepts second timestamps within 5 minutes", () => {
    expect(isRecentTimestamp(String(Math.floor(now / 1000) - 60), now)).toBe(true);
  });

  it("rejects stale, future and non-numeric timestamps", () => {
    expect(isRecentTimestamp(String(now - 6 * 60_000), now)).toBe(false);
    expect(isRecentTimestamp(String(now + 6 * 60_000), now)).toBe(false);
    expect(isRecentTimestamp("yesterday", now)).toBe(false);
    expect(isRecentTimestamp(null, now)).toBe(false);
  });
});
