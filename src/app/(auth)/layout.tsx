import { Logo } from "@/components/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-neutral-50 px-4 py-12">
      <Logo className="mb-8" />
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-7 shadow-card">
        {children}
      </div>
      <p className="mt-8 text-center text-[13px] text-neutral-500">
        Dues collection for self-managed communities
        <span className="mx-2 text-neutral-300">·</span>
        Payments secured by Stripe
      </p>
    </div>
  );
}
