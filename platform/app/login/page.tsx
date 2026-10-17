import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="login-wrap">
      <div className="panel login-card">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            ↗
          </span>
          Signal Desk
        </div>
        <LoginForm next={next ?? "/"} />
      </div>
    </div>
  );
}
