import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Signal Desk", template: "%s · Signal Desk" },
  description: "Private KamdenAI signal dashboard and trade journal",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
