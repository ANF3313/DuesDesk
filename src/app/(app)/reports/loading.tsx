import { Skeleton, StatCardSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function ReportsLoading() {
  return (
    <div>
      <Skeleton className="h-7 w-28" />
      <Skeleton className="mt-2 h-4 w-72" />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <div className="mt-6">
        <TableSkeleton rows={8} />
      </div>
    </div>
  );
}
