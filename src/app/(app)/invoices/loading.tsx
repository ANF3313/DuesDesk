import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function InvoicesLoading() {
  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Skeleton className="h-7 w-28" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-9.5 w-28" />
      </div>
      <Skeleton className="mb-4 h-9 w-64 rounded-lg" />
      <TableSkeleton rows={7} />
    </div>
  );
}
