import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-neutral-50 px-4">
      <Logo />
      <h1 className="mt-8 text-xl font-semibold tracking-tight text-neutral-950">
        This page doesn&apos;t exist
      </h1>
      <p className="mt-2 max-w-sm text-center text-sm text-neutral-500">
        The link may have been reset or mistyped. If someone sent you a pay
        link, ask them to send a fresh one.
      </p>
      <Link
        href="/"
        className="mt-6 text-sm font-medium text-pine-600 hover:text-pine-700"
      >
        Back to DuesDesk
      </Link>
    </div>
  );
}
