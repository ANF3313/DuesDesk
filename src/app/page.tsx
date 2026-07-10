import Link from "next/link";
import { Logo } from "@/components/logo";
import { StatusPill } from "@/components/ui/status-pill";
import {
  IconAnnounce,
  IconArrowRight,
  IconBanknote,
  IconBuilding,
  IconCheck,
  IconLink,
  IconMail,
  IconRefresh,
  IconShield,
} from "@/components/ui/icons";

function Container({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`mx-auto w-full max-w-6xl px-4 md:px-6 ${className}`}>
      {children}
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/70 bg-neutral-25/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Logo />
        <nav aria-label="Site" className="hidden items-center gap-7 text-sm text-neutral-600 md:flex">
          <a href="#features" className="transition-colors hover:text-neutral-950">Features</a>
          <a href="#pricing" className="transition-colors hover:text-neutral-950">Pricing</a>
          <a href="#faq" className="transition-colors hover:text-neutral-950">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="rounded-md px-3.5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-600"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-md bg-pine-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-pine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-600 focus-visible:ring-offset-2"
          >
            Start free trial
          </Link>
        </div>
      </Container>
    </header>
  );
}

function DashboardMock() {
  const rows = [
    { unit: "Unit 2A", memo: "July dues", amount: "$350.00", kind: "paid" as const },
    { unit: "Unit 4B", memo: "July dues", amount: "$350.00", kind: "overdue" as const },
    { unit: "12 Elm St", memo: "Roof assessment", amount: "$1,200.00", kind: "due" as const },
    { unit: "Unit 1C", memo: "July dues", amount: "$350.00", kind: "processing" as const },
  ];
  return (
    <div aria-hidden="true" className="rounded-xl border border-neutral-200 bg-white p-5 shadow-modal md:p-6">
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Outstanding", "$1,900.00"],
          ["Overdue", "$350.00"],
          ["Collected in July", "$4,550.00"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-neutral-200 bg-neutral-25 p-3.5">
            <p className="text-[11px] font-medium text-neutral-500 md:text-xs">{label}</p>
            <p className={`mt-1 text-sm font-semibold tabular-nums tracking-tight md:text-lg ${label === "Overdue" ? "text-overdue-fg" : "text-neutral-950"}`}>
              {value}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 divide-y divide-neutral-100 border-t border-neutral-100">
        {rows.map((r) => (
          <div key={r.unit} className="flex items-center justify-between gap-2 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-neutral-950">{r.unit}</p>
              <p className="truncate text-xs text-neutral-500">{r.memo}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-[13px] font-medium tabular-nums text-neutral-950">{r.amount}</span>
              <StatusPill kind={r.kind} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: IconRefresh,
    title: "Dues on autopilot",
    body: "Set the amount and cadence once. Invoices create themselves, chase themselves — and with autopay, they even pay themselves.",
  },
  {
    icon: IconLink,
    title: "One-tap pay links",
    body: "Every member gets a private link — no account, no password, no app to install. Open, tap, paid.",
  },
  {
    icon: IconBanknote,
    title: "Money goes straight to you",
    body: "Payments settle directly into your organization's bank account through your own Stripe account. We never hold a cent.",
  },
  {
    icon: IconCheck,
    title: "Books that keep themselves",
    body: "The moment a payment clears, the invoice marks itself paid. No spreadsheet, no Sunday-night reconciling.",
  },
  {
    icon: IconAnnounce,
    title: "Reach everyone at once",
    body: "Meeting notices, pool schedules, assessments — one message, every member's inbox, individually addressed.",
  },
  {
    icon: IconBuilding,
    title: "Built for under 50 units",
    body: "Dues, expenses, and annual-meeting reports for self-managed HOAs and small landlords — without the property-manager bloat.",
  },
];

const TIERS = [
  {
    name: "Solo",
    price: "$19",
    blurb: "For landlords with a handful of doors.",
    features: ["Up to 10 units", "Recurring dues + member autopay", "Card and bank (ACH) payments", "Expense tracking and reports"],
    featured: false,
  },
  {
    name: "Community",
    price: "$49",
    blurb: "For self-managed HOAs and condo boards.",
    features: ["Up to 50 units", "Everything in Solo", "Announcement emails", "Priority support"],
    featured: true,
  },
  {
    name: "Concierge",
    price: "$99",
    blurb: "For portfolios and larger communities.",
    features: ["Up to 150 units", "Everything in Community", "Hands-on onboarding", "Data import help"],
    featured: false,
  },
];

const FAQS = [
  {
    q: "Where does the money actually go?",
    a: "Directly to your organization. During setup you connect your own Stripe account (it takes a few minutes), and every payment settles straight to your bank. DuesDesk never holds, touches, or routes your community's funds.",
  },
  {
    q: "What does it cost members to pay?",
    a: "Stripe's standard processing fees apply — roughly 2.9% + 30¢ for cards, and about 0.8% capped at $5 for bank (ACH) payments. For typical dues amounts, ACH is dramatically cheaper, and members can choose either at checkout.",
  },
  {
    q: "Do members need to create accounts?",
    a: "No. Each unit gets a private, unguessable pay link sent by email. Members open it, see exactly what they owe, and pay. If a link is ever shared with the wrong person, you can reset it in one click.",
  },
  {
    q: "Can I use it for rentals instead of an HOA?",
    a: "Yes — units, dues, and pay links work identically for rent. Small landlords use DuesDesk to collect rent with automatic reminders and clean records.",
  },
  {
    q: "What about members who pay by check?",
    a: "Online payment is optional for members. When a check or cash arrives, mark the invoice paid in one click — it's recorded as an offline payment and your reports stay accurate.",
  },
  {
    q: "Is our data separated from other organizations?",
    a: "Yes, at the database level. Every record is isolated per organization with PostgreSQL row-level security — the same isolation model used by banking software — so one community's data is invisible to every other.",
  },
];

export default function LandingPage() {
  return (
    <div className="bg-neutral-25">
      <Header />

      {/* Hero */}
      <section className="overflow-hidden border-b border-neutral-200/70">
        <Container className="grid items-center gap-10 py-16 md:py-24 lg:grid-cols-2 lg:gap-14">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-pine-200 bg-pine-50 px-3 py-1 text-xs font-medium text-pine-700">
              For self-managed HOAs and small landlords
            </p>
            <h1 className="mt-5 font-display text-[2.6rem] font-medium leading-[1.08] tracking-tight text-neutral-950 md:text-6xl">
              Dues collected.
              <br />
              <em className="text-pine-700">Community calm.</em>
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-neutral-600 md:text-lg">
              DuesDesk invoices your members, takes their payment online, and
              keeps the books — so nobody has to chase a neighbor for money
              again.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/sign-up"
                className="inline-flex h-11 items-center gap-2 rounded-md bg-pine-600 px-5 text-[15px] font-medium text-white transition-colors hover:bg-pine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-600 focus-visible:ring-offset-2"
              >
                Start free trial
                <IconArrowRight width={16} height={16} />
              </Link>
              <a
                href="#pricing"
                className="inline-flex h-11 items-center rounded-md border border-neutral-300 bg-white px-5 text-[15px] font-medium text-neutral-800 transition-colors hover:border-neutral-400 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-600 focus-visible:ring-offset-2"
              >
                See pricing
              </a>
            </div>
            <p className="mt-5 text-[13px] text-neutral-500">
              Free for 14 days · No card required · Cancel anytime
            </p>
          </div>
          <DashboardMock />
        </Container>
      </section>

      {/* Trust strip — plain and static, no motion */}
      <section aria-label="Trust and security" className="border-b border-neutral-200/70 bg-white">
        <Container className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 py-4">
          {[
            [IconShield, "Payments secured by Stripe"],
            [IconCheck, "Bank-level encryption"],
            [IconBanknote, "Your money never touches DuesDesk"],
            [IconBuilding, "Each community's data fully isolated"],
          ].map(([Icon, label]) => {
            const IconComp = Icon as typeof IconShield;
            return (
              <span
                key={label as string}
                className="flex items-center gap-1.5 text-[13px] text-neutral-500"
              >
                <IconComp width={14} height={14} className="text-pine-600" />
                {label as string}
              </span>
            );
          })}
        </Container>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-16 py-16 md:py-24">
        <Container>
          <h2 className="max-w-xl font-display text-3xl font-medium tracking-tight text-neutral-950 md:text-4xl">
            Everything a volunteer treasurer needs. Nothing they don&apos;t.
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card transition-shadow duration-150 hover:shadow-pop"
              >
                <span className="flex size-9 items-center justify-center rounded-md bg-pine-50 text-pine-600">
                  <Icon width={18} height={18} />
                </span>
                <h3 className="mt-3.5 text-[15px] font-semibold text-neutral-950">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section className="border-y border-neutral-200/70 bg-white py-16 md:py-20">
        <Container>
          <h2 className="font-display text-3xl font-medium tracking-tight text-neutral-950 md:text-4xl">
            Live in an afternoon
          </h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              ["Connect your bank", "Link your organization's own Stripe account. Dues settle directly to your bank — setup takes minutes."],
              ["Add your units", "Each home, its owner or tenant, their email, and what they pay. Import help available if you're moving off a spreadsheet."],
              ["Set dues and relax", "Recurring invoices go out on schedule with a private pay link. Payments mark themselves paid. You watch the dashboard turn green."],
            ].map(([title, body], i) => (
              <li key={title} className="relative">
                <span className="flex size-8 items-center justify-center rounded-full bg-pine-600 text-sm font-semibold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-3.5 text-[15px] font-semibold text-neutral-950">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-16 py-16 md:py-24">
        <Container>
          <div className="max-w-xl">
            <h2 className="font-display text-3xl font-medium tracking-tight text-neutral-950 md:text-4xl">
              Simple pricing, no contracts
            </h2>
            <p className="mt-3 text-neutral-600">
              Every plan includes online payments, automatic reconciliation, and
              member pay links. Try any plan free for 14 days — no card required.
            </p>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-xl border bg-white p-6 shadow-card ${
                  tier.featured ? "border-pine-600 ring-1 ring-pine-600" : "border-neutral-200"
                }`}
              >
                {tier.featured && (
                  <span className="absolute -top-3 left-6 rounded-full bg-pine-600 px-2.5 py-0.5 text-xs font-medium text-white">
                    Most popular
                  </span>
                )}
                <h3 className="text-[15px] font-semibold text-neutral-950">{tier.name}</h3>
                <p className="mt-1 text-[13px] text-neutral-500">{tier.blurb}</p>
                <p className="mt-4">
                  <span className="text-3xl font-semibold tracking-tight text-neutral-950">{tier.price}</span>
                  <span className="text-sm text-neutral-500"> / month</span>
                </p>
                <ul className="mt-5 space-y-2.5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-neutral-700">
                      <IconCheck width={15} height={15} className="mt-0.5 shrink-0 text-pine-600" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-up"
                  className={`mt-6 flex h-10 items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-600 focus-visible:ring-offset-2 ${
                    tier.featured
                      ? "bg-pine-600 text-white hover:bg-pine-700"
                      : "border border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400 hover:bg-neutral-50"
                  }`}
                >
                  Start free trial
                </Link>
              </div>
            ))}
          </div>
          <div className="mt-8 max-w-3xl rounded-lg border border-pine-200 bg-pine-50 px-5 py-4">
            <p className="text-sm font-semibold text-pine-900">
              What does it cost your members to pay?
            </p>
            <p className="mt-1 text-sm leading-relaxed text-pine-800">
              Bank (ACH) payments cost ~0.8% capped at $5 — about $2.80 on $350
              dues. Cards run ~2.9% + 30¢. Members pick at checkout, and the
              fees go to Stripe, not DuesDesk.
            </p>
          </div>
        </Container>
      </section>

      {/* Product proof — real UI, honest early-access status.
          TODO: replace the mock below with real screenshots (e.g.
          /public/screenshots/dashboard.png rendered via next/image) once
          captured from the live app with the Maple Court demo data.
          TODO: when the first pilot customer signs off, add their quote
          here with a real name and community. */}
      <section className="border-y border-neutral-200/70 bg-white py-16 md:py-20">
        <Container>
          <div className="max-w-xl">
            <h2 className="font-display text-3xl font-medium tracking-tight text-neutral-950 md:text-4xl">
              See exactly what your board sees
            </h2>
            <p className="mt-3 text-neutral-600">
              No demo call, no sales deck — this is the treasurer&apos;s actual
              view: who&apos;s paid, who&apos;s behind, and what it all adds up to.
            </p>
          </div>
          <div className="mx-auto mt-10 max-w-3xl">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 md:p-4">
              <DashboardMock />
            </div>
            <p className="mt-3 text-center text-[13px] text-neutral-500">
              The dues dashboard · DuesDesk is in pilot testing now — early-access
              spots are open.
            </p>
          </div>
        </Container>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-16 py-16 md:py-24">
        <Container className="max-w-3xl">
          <h2 className="font-display text-3xl font-medium tracking-tight text-neutral-950 md:text-4xl">
            Questions boards actually ask
          </h2>
          <div className="mt-8 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white shadow-card">
            {FAQS.map((f) => (
              <details key={f.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md text-[15px] font-medium text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-600 [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span
                    aria-hidden="true"
                    className="text-neutral-400 transition-transform duration-150 group-open:rotate-45"
                  >
                    <IconArrowRight width={16} height={16} className="rotate-90" />
                  </span>
                </summary>
                <p className="mt-3 pr-8 text-sm leading-relaxed text-neutral-600">{f.a}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      {/* CTA band */}
      <section className="bg-pine-950 py-16 md:py-20">
        <Container className="text-center">
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-medium tracking-tight text-white md:text-4xl">
            Send your last “friendly reminder about dues” email
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] text-pine-200">
            Set up your community tonight; collect on schedule forever.
          </p>
          <Link
            href="/sign-up"
            className="mt-8 inline-flex h-11 items-center gap-2 rounded-md bg-white px-6 text-[15px] font-medium text-pine-900 transition-colors hover:bg-pine-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-pine-950"
          >
            Start free trial
            <IconArrowRight width={16} height={16} />
          </Link>
        </Container>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200/70 bg-neutral-25">
        <Container className="flex flex-col items-center justify-between gap-4 py-10 md:flex-row">
          <Logo />
          <nav aria-label="Footer" className="flex items-center gap-6 text-[13px] text-neutral-500">
            <a href="#features" className="transition-colors hover:text-neutral-950">Features</a>
            <a href="#pricing" className="transition-colors hover:text-neutral-950">Pricing</a>
            <a href="#faq" className="transition-colors hover:text-neutral-950">FAQ</a>
            <Link href="/sign-in" className="transition-colors hover:text-neutral-950">Sign in</Link>
          </nav>
          <p className="flex items-center gap-1.5 text-[13px] text-neutral-500">
            <IconMail width={14} height={14} /> hello@duesdesk.example · © 2026 DuesDesk
          </p>
        </Container>
      </footer>
    </div>
  );
}
