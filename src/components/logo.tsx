import Link from "next/link";
import { cn } from "@/lib/cn";

export function Logo({
  href = "/",
  className,
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-600 focus-visible:ring-offset-2",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-7 items-center justify-center rounded-md bg-pine-600"
      >
        <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-neutral-950">
        DuesDesk
      </span>
    </Link>
  );
}
