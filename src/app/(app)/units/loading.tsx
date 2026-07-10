import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function UnitsLoading() {
  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Skeleton className="h-7 w-24" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <Skeleton className="h-9.5 w-28" />
      </div>
      <TableSkeleton rows={6} />
    </div>
  );
}
