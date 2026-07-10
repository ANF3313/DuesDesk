import { Skeleton, StatCardSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function ExpensesLoading() {
  return (
    <div>
      <Skeleton className="h-7 w-28" />
      <Skeleton className="mt-2 h-4 w-64" />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:w-1/2 lg:gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <div className="mt-6">
        <TableSkeleton rows={6} />
      </div>
    </div>
  );
}
