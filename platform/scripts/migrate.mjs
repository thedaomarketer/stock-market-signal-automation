// Applies migrations/*.sql in filename order, recording each in schema_migrations.
// Usage: DATABASE_URL=... npm run db:migrate
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "migrations");

export async function migrate(sql) {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
  const applied = new Set((await sql`SELECT name FROM schema_migrations`).map((r) => r.name));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const ran = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const text = fs.readFileSync(path.join(dir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(text);
      await tx`INSERT INTO schema_migrations (name) VALUES (${file})`;
    });
    ran.push(file);
  }
  return ran;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }
  const sql = postgres(process.env.DATABASE_URL, { prepare: false, onnotice: () => {} });
  try {
    const ran = await migrate(sql);
    console.log(ran.length ? `Applied: ${ran.join(", ")}` : "Database is up to date");
  } finally {
    await sql.end();
  }
}
