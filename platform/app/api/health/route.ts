import { db } from "@/lib/db";

export async function GET() {
  let database = false;
  try {
    await db()`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }
  return Response.json({ ok: database, database }, { status: database ? 200 : 503 });
}
