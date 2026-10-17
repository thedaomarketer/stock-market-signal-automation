"use client";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="panel">
      <h2>Something went wrong loading this page</h2>
      <p className="subtle">
        Most often this means the database isn&apos;t reachable or migrations haven&apos;t run. Check that DATABASE_URL
        is set and run <code>npm run db:migrate</code>, then try again.
      </p>
      {error.digest && <p className="subtle">Error reference: {error.digest}</p>}
      <button className="btn" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
