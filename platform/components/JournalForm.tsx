"use client";

import { useActionState, useEffect, useRef } from "react";
import { createJournalEntry, type FormState } from "@/app/actions";

export function JournalForm({ defaults }: { defaults: { dateKey: string; ticker: string; fill: string } }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createJournalEntry, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="form-grid">
      <div>
        <label htmlFor="dateKey">Session</label>
        <input id="dateKey" name="dateKey" type="date" defaultValue={defaults.dateKey} required />
      </div>
      <div>
        <label htmlFor="ticker">Ticker</label>
        <input id="ticker" name="ticker" defaultValue={defaults.ticker} required autoCapitalize="characters" />
      </div>
      <div>
        <label htmlFor="shares">Shares</label>
        <input id="shares" name="shares" type="number" step="any" min="0" required />
      </div>
      <div>
        <label htmlFor="fillPrice">Your fill price</label>
        <input id="fillPrice" name="fillPrice" type="number" step="any" min="0" defaultValue={defaults.fill} required />
      </div>
      <div>
        <label htmlFor="exitPrice">Exit price (optional)</label>
        <input id="exitPrice" name="exitPrice" type="number" step="any" min="0" />
      </div>
      <div>
        <label htmlFor="fees">Fees</label>
        <input id="fees" name="fees" type="number" step="any" min="0" defaultValue="0" />
      </div>
      <div className="wide">
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={2} placeholder="Why you took it, how execution went, what you'd change" />
      </div>
      <div className="wide" style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add to journal"}
        </button>
        <span aria-live="polite" className={state.error ? "neg" : "pos"} style={{ fontSize: 13 }}>
          {state.error ?? state.ok}
        </span>
      </div>
    </form>
  );
}
