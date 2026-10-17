import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, sessionSecret, verifySessionToken } from "./auth";

/** Second check behind proxy.ts, for pages and server actions. */
export async function requireAuth() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token, sessionSecret()))) redirect("/login");
}

/** Today's session key in US Eastern time, e.g. 2026-10-16. */
export function todayKeyET(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
}
