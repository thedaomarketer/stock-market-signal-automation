"use client";

import { useActionState } from "react";
import { login, type FormState } from "@/app/actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});
  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" autoFocus required />
      {state.error && (
        <p className="neg" style={{ fontSize: 13, margin: "8px 0 0" }} aria-live="polite">
          {state.error}
        </p>
      )}
      <button className="btn primary" type="submit" disabled={pending} style={{ width: "100%", marginTop: 14 }}>
        {pending ? "Checking…" : "Log in"}
      </button>
    </form>
  );
}
