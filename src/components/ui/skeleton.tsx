import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-shimmer rounded-md",
        "bg-[linear-gradient(90deg,var(--color-neutral-100)_25%,var(--color-neutral-200)_45%,var(--color-neutral-100)_65%)]",
        "bg-[length:200%_100%]",
        className,
      )}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="mt-3 h-7 w-32" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white shadow-card">
      <div className="border-b border-neutral-100 px-5 py-4">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="space-y-4 px-5 py-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
