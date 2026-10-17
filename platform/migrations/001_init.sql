-- Every delivery exactly as received. delivery_id makes retries idempotent.
CREATE TABLE events (
  id            bigserial PRIMARY KEY,
  delivery_id   text NOT NULL UNIQUE,
  event         text NOT NULL,
  date_key      date,
  sent_at       timestamptz,
  received_at   timestamptz NOT NULL DEFAULT now(),
  source        text NOT NULL DEFAULT 'webhook' CHECK (source IN ('webhook', 'sample')),
  payload       jsonb NOT NULL
);
CREATE INDEX events_received_at_idx ON events (received_at DESC);

-- One row per trading session.
CREATE TABLE sessions (
  date_key               date PRIMARY KEY,
  scan_id                text,
  research_watchlist     jsonb,
  morning_scan           jsonb,
  confirmation_complete  boolean,
  confirmation_message   text,
  published_at           timestamptz,
  no_confirmed_buys      boolean,
  study_results          jsonb,
  results_received_at    timestamptz,
  is_sample              boolean NOT NULL DEFAULT false,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Ranked candidates with their opening decision and modeled morning result.
CREATE TABLE candidates (
  date_key          date NOT NULL REFERENCES sessions (date_key) ON DELETE CASCADE,
  ticker            text NOT NULL,
  name              text,
  rank              integer,
  status_code       text,
  status_label      text,
  category          text,
  entry             double precision,
  stop              double precision,
  target            double precision,
  result_status     text,
  result_label      text,
  result_finalized  boolean,
  execution_price   double precision,
  exit_price        double precision,
  profit_per_share  double precision,
  result_basis      text,
  execution_basis   text,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (date_key, ticker)
);

-- Your own broker fills. Kept separate from published records on purpose.
CREATE TABLE journal_entries (
  id          bigserial PRIMARY KEY,
  date_key    date NOT NULL,
  ticker      text NOT NULL,
  shares      double precision NOT NULL CHECK (shares > 0),
  fill_price  double precision NOT NULL CHECK (fill_price > 0),
  exit_price  double precision CHECK (exit_price > 0),
  fees        double precision NOT NULL DEFAULT 0 CHECK (fees >= 0),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX journal_entries_date_idx ON journal_entries (date_key DESC, ticker);
