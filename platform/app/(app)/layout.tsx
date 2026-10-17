import { logout } from "@/app/actions";
import { Nav } from "@/components/Nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            ↗
          </span>
          Signal Desk
        </div>
        <Nav />
        <div className="sidebar-foot">
          <form action={logout}>
            <button className="btn small ghost" type="submit">
              Log out
            </button>
          </form>
          <span className="foot-note">Published KamdenAI records plus your own journal. Not financial advice.</span>
        </div>
      </aside>
      <main className="main">
        {children}
        <p className="disclaimer">
          Confirmed is an official published signal, not a broker fill. Morning results are modeled reference records
          and exclude your own costs and fills. Signals can lose money, and several can lose together. This dashboard
          never places orders.
        </p>
      </main>
    </div>
  );
}
