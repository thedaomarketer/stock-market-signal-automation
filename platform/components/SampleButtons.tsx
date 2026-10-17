import { clearSampleData, loadSampleData } from "@/app/actions";

export function LoadSampleButton({ label = "Load sample data" }: { label?: string }) {
  return (
    <form action={loadSampleData}>
      <button className="btn primary" type="submit">
        {label}
      </button>
    </form>
  );
}

export function ClearSampleButton() {
  return (
    <form action={clearSampleData}>
      <button className="btn danger" type="submit">
        Clear sample data
      </button>
    </form>
  );
}
