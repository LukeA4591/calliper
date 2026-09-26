import type { Metadata } from "next";
import "./globals.css";
import "./forge.css";
export const metadata: Metadata = {
  title: {
    default: "Calliper · Drawing analysis",
    template: "%s · Calliper",
  },
  description:
    "Evidence-led manufacturing reviews. A clearer path from engineering drawing to production.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-surface focus:p-4"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
