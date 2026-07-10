"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { Logo } from "./logo";
import { signOut } from "@/app/(auth)/actions";
import {
  IconAnnounce,
  IconBanknote,
  IconBuilding,
  IconChart,
  IconLogout,
  IconReceipt,
  IconSettings,
  IconWallet,
  IconX,
} from "./ui/icons";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: IconBanknote },
  { href: "/units", label: "Units", icon: IconBuilding },
  { href: "/invoices", label: "Invoices", icon: IconReceipt },
  { href: "/expenses", label: "Expenses", icon: IconWallet },
  { href: "/reports", label: "Reports", icon: IconChart },
  { href: "/announcements", label: "Announcements", icon: IconAnnounce },
  { href: "/settings", label: "Settings", icon: IconSettings },
];

export function AppShell({
  orgName,
  email,
  chargesEnabled,
  children,
}: {
  orgName: string;
  email: string;
  chargesEnabled: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Calm setup nudge, dismissible for the session. Starts hidden so the
  // server and first client render agree; appears after hydration.
  const [nudgeDismissed, setNudgeDismissed] = useState(true);
  useEffect(() => {
    setNudgeDismissed(sessionStorage.getItem("dd-stripe-nudge") === "1");
  }, []);

  const navLinks = (compact: boolean) =>
    NAV.map(({ href, label, icon: Icon }) => {
      const active = pathname.startsWith(href);
      return (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-md text-sm transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-600",
            compact ? "shrink-0 px-3 py-2" : "px-3 py-2",
            active
              ? "bg-neutral-100 font-medium text-neutral-950"
              : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950",
          )}
        >
          <Icon
            width={17}
            height={17}
            className={active ? "text-pine-600" : "text-neutral-400"}
          />
          {label}
        </Link>
      );
    });

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-neutral-200 bg-white print:hidden lg:flex">
        <div className="sticky top-0 flex h-dvh flex-col px-4 py-5">
          <Logo href="/dashboard" />
          <p className="mt-4 truncate rounded-md bg-neutral-50 px-3 py-2 text-[13px] font-medium text-neutral-700">
            {orgName}
          </p>
          <nav aria-label="Main" className="mt-4 space-y-0.5">
            {navLinks(false)}
          </nav>
          <div className="mt-auto border-t border-neutral-100 pt-4">
            <p className="truncate px-3 text-xs text-neutral-500">{email}</p>
            <form action={signOut}>
              <button
                type="submit"
                className="mt-1.5 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-600"
              >
                <IconLogout width={17} height={17} className="text-neutral-400" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="min-w-0 flex-1">
        <header className="border-b border-neutral-200 bg-white print:hidden lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Logo href="/dashboard" />
            <form action={signOut}>
              <button
                type="submit"
                aria-label="Sign out"
                className="rounded-md p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-600"
              >
                <IconLogout width={18} height={18} />
              </button>
            </form>
          </div>
          <nav
            aria-label="Main"
            className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none]"
          >
            {navLinks(true)}
          </nav>
        </header>

        {!chargesEnabled && !nudgeDismissed && pathname !== "/settings" && (
          <div className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 print:hidden lg:px-8">
            <p className="text-[13px] text-neutral-600">
              One step left before members can pay online:{" "}
              <Link
                href="/settings"
                className="font-medium text-pine-700 underline underline-offset-2 hover:text-pine-800"
              >
                connect your Stripe account
              </Link>
              .
            </p>
            <button
              type="button"
              aria-label="Dismiss for now"
              className="rounded p-1 text-neutral-400 transition-colors hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-600"
              onClick={() => {
                sessionStorage.setItem("dd-stripe-nudge", "1");
                setNudgeDismissed(true);
              }}
            >
              <IconX width={14} height={14} />
            </button>
          </div>
        )}

        <main className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
