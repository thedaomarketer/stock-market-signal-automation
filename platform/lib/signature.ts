import crypto from "node:crypto";

export const REPLAY_WINDOW_MS = 5 * 60 * 1000;

/** HMAC-SHA256 over `${timestamp}.${rawBody}`, compared in constant time. */
export function verifySignature(input: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  secret: string;
}): boolean {
  const { rawBody, timestamp, secret } = input;
  if (!secret || !timestamp || !input.signature) return false;

  const signature = input.signature.replace(/^sha256=/, "");
  if (!/^[0-9a-f]+$/i.test(signature)) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
  const received = Buffer.from(signature, "hex");
  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(received, expected);
}

/** Accepts Unix seconds or milliseconds; rejects anything outside the replay window. */
export function isRecentTimestamp(timestamp: string | null, now = Date.now()): boolean {
  if (!timestamp) return false;
  const value = Number(timestamp);
  if (!Number.isFinite(value)) return false;
  const ms = value < 1e12 ? value * 1000 : value;
  return Math.abs(now - ms) <= REPLAY_WINDOW_MS;
}
