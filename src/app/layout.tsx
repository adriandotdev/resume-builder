import type { Metadata, Viewport } from "next";
import { Source_Serif_4, Young_Serif } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { ToastProvider } from "@/components/Toast";

// Self-hosted by next/font at build time: the browser never contacts Google.
const display = Young_Serif({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });
const text = Source_Serif_4({ subsets: ["latin"], variable: "--font-text", style: ["normal", "italic"], axes: ["opsz"], display: "swap" });

export const metadata: Metadata = {
  title: "Resume Builder",
  description: "Free, private resume builder with single-column templates that follow common ATS-safe practices. Everything stays in your browser.",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};
const themeInit = `try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInit }} /></head>
      <body className="flex min-h-dvh flex-col">
        <ToastProvider>
          <a href="#main" className="no-print btn btn-primary sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100]">Skip to content</a>
          <SiteHeader />
          <main id="main" className="flex-1">{children}</main>
          <SiteFooter />
        </ToastProvider>
        <Analytics />
      </body>
    </html>
  );
}
