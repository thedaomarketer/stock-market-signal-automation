import postgres from "postgres";

export type Sql = postgres.Sql;

const globalForDb = globalThis as unknown as { __signalsSql?: Sql };

export function createSql(url: string): Sql {
  // prepare:false keeps us compatible with Neon's pooled (pgbouncer) connection string.
  return postgres(url, { prepare: false, max: 5, idle_timeout: 20, onnotice: () => {} });
}

/** Shared connection pool, reused across hot reloads and warm serverless invocations. */
export function db(): Sql {
  if (!globalForDb.__signalsSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalForDb.__signalsSql = createSql(url);
  }
  return globalForDb.__signalsSql;
}
