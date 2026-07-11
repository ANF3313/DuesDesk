import { Skeleton, StatCardSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div>
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-2 h-4 w-64" />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <TableSkeleton rows={4} />
          <TableSkeleton rows={6} />
        </div>
        <div className="space-y-5">
          <TableSkeleton rows={4} />
          <TableSkeleton rows={4} />
        </div>
      </div>
    </div>
  );
}
