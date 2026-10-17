import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionSecret, verifySessionToken } from "@/lib/auth";

// Everything requires login except the login page and the signed webhook endpoint.
const PUBLIC_PATHS = ["/login", "/api/webhook", "/api/health"];

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) return NextResponse.next();

  const ok = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value, sessionSecret());
  if (ok) return NextResponse.next();

  if (path.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL("/login", req.url);
  if (path !== "/") url.searchParams.set("next", path);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
