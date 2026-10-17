"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { checkPassword, createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS, sessionSecret } from "@/lib/auth";
import { db } from "@/lib/db";
import { addJournalEntry, deleteJournalEntry, setJournalExit } from "@/lib/queries";
import { requireAuth } from "@/lib/session";
import { clearSamples, ingest } from "@/lib/store";
import research from "@/samples/research-watchlist.json";
import morning from "@/samples/morning-scan.json";
import confirmed from "@/samples/confirmed-buys.json";
import results from "@/samples/quick-exit-results.json";

export type FormState = { error?: string; ok?: string };

export async function login(_prev: FormState, form: FormData): Promise<FormState> {
  const secret = sessionSecret();
  if (!secret) return { error: "SESSION_SECRET must be set (32+ characters) before you can log in." };
  if (!process.env.DASHBOARD_PASSWORD) return { error: "DASHBOARD_PASSWORD is not set." };

  const ok = await checkPassword(String(form.get("password") ?? ""), process.env.DASHBOARD_PASSWORD, secret);
  if (!ok) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return { error: "Wrong password." };
  }

  (await cookies()).set(SESSION_COOKIE, await createSessionToken(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  const next = String(form.get("next") ?? "/");
  redirect(/^\/(?![\/\\])/.test(next) ? next : "/"); // same-origin paths only
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function loadSampleData() {
  await requireAuth();
  const sql = db();
  const samples = [research, morning, confirmed, results];
  for (const [i, payload] of samples.entries()) {
    await ingest(sql, { rawBody: JSON.stringify(payload), deliveryId: `sample-${i}`, headerEvent: null, source: "sample" });
  }
  revalidatePath("/", "layout");
}

export async function clearSampleData() {
  await requireAuth();
  await clearSamples(db());
  revalidatePath("/", "layout");
}

const toNumber = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

export async function createJournalEntry(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAuth();
  const dateKey = String(form.get("dateKey") ?? "");
  const ticker = String(form.get("ticker") ?? "").trim().toUpperCase();
  const shares = toNumber(form.get("shares"));
  const fillPrice = toNumber(form.get("fillPrice"));
  const exitPrice = toNumber(form.get("exitPrice"));
  const fees = toNumber(form.get("fees")) ?? 0;
  const notes = String(form.get("notes") ?? "").trim() || null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return { error: "Pick a session date." };
  if (!/^[A-Z0-9.\-]{1,12}$/.test(ticker)) return { error: "Enter a ticker." };
  if (!shares || shares <= 0) return { error: "Shares must be greater than 0." };
  if (!fillPrice || fillPrice <= 0) return { error: "Fill price must be greater than 0." };
  if (exitPrice !== null && !(exitPrice > 0)) return { error: "Exit price must be greater than 0, or left empty." };
  if (!(fees >= 0)) return { error: "Fees can't be negative." };

  await addJournalEntry(db(), { dateKey, ticker, shares, fillPrice, exitPrice, fees, notes });
  revalidatePath("/", "layout");
  return { ok: `Logged ${shares} ${ticker} @ ${fillPrice}.` };
}

export async function closeJournalEntry(form: FormData) {
  await requireAuth();
  const id = String(form.get("id") ?? "");
  const exitPrice = toNumber(form.get("exitPrice"));
  if (!/^\d+$/.test(id) || exitPrice === null || !(exitPrice > 0)) return;
  await setJournalExit(db(), id, exitPrice);
  revalidatePath("/", "layout");
}

export async function removeJournalEntry(form: FormData) {
  await requireAuth();
  const id = String(form.get("id") ?? "");
  if (!/^\d+$/.test(id)) return;
  await deleteJournalEntry(db(), id);
  revalidatePath("/", "layout");
}
