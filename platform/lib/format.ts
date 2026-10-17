const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export const money = (n: number | null | undefined) => (n === null || n === undefined ? "—" : usd.format(n));

export const price = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

export const signed = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(digits)}`;

export function timeET(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(d)) + " ET";
}

export function dateTimeET(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(d)) + " ET";
}

export function longDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}
