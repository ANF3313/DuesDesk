import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

function metadataBase(): URL {
  // NEXT_PUBLIC_APP_URL may be unset or a placeholder during first deploys —
  // never let that break the build.
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}

const description =
  "Collect HOA dues and rent on time, without spreadsheets or awkward reminders. Members pay by card or bank from a private link; invoices mark themselves paid. Built for self-managed HOAs and small landlords.";

export const metadata: Metadata = {
  metadataBase: metadataBase(),
  applicationName: "DuesDesk",
  title: {
    default: "DuesDesk — dues collection for self-managed communities",
    template: "%s · DuesDesk",
  },
  description,
  openGraph: {
    type: "website",
    siteName: "DuesDesk",
    title: "DuesDesk — Dues collected. Community calm.",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "DuesDesk — Dues collected. Community calm.",
    description,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable}`}>
      <body className="font-sans antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
