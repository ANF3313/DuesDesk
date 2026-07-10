import { cn } from "@/lib/cn";

export function Table({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full text-sm", className)}>{children}</table>
    </div>
  );
}

export function Th({
  className,
  children,
  align,
}: {
  className?: string;
  children?: React.ReactNode;
  align?: "right";
}) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap border-b border-neutral-200 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-neutral-500",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  className,
  children,
  align,
}: {
  className?: string;
  children?: React.ReactNode;
  align?: "right";
}) {
  return (
    <td
      className={cn(
        "border-b border-neutral-100 px-4 py-3 align-middle",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </td>
  );
}
