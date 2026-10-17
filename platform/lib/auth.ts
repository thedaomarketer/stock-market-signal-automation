// Single-owner login: one password from env, and an HMAC-signed, expiring cookie.
// Uses Web Crypto only so the same code runs in proxy.ts, route handlers and server actions.

export const SESSION_COOKIE = "signals_session";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

const enc = new TextEncoder();

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Buffer.from(sig).toString("base64url");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function sessionSecret(): string | null {
  const s = process.env.SESSION_SECRET;
  return s && s.length >= 32 ? s : null;
}

export async function createSessionToken(secret: string, now = Date.now()): Promise<string> {
  const exp = Math.floor(now / 1000) + SESSION_TTL_SECONDS;
  return `${exp}.${await hmac(secret, `session.${exp}`)}`;
}

export async function verifySessionToken(token: string | undefined, secret: string | null, now = Date.now()) {
  if (!token || !secret) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!Number.isInteger(exp) || !sig || exp < Math.floor(now / 1000)) return false;
  return constantTimeEqual(sig, await hmac(secret, `session.${exp}`));
}

/** Compares HMAC digests so the comparison is constant-time regardless of input length. */
export async function checkPassword(input: string, expected: string | undefined, secret: string): Promise<boolean> {
  if (!expected || !input) return false;
  const [a, b] = await Promise.all([hmac(secret, `pw.${input}`), hmac(secret, `pw.${expected}`)]);
  return constantTimeEqual(a, b);
}
