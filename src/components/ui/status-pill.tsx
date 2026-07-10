import { cn } from "@/lib/cn";

export type StatusKind = "paid" | "overdue" | "due" | "processing" | "void";

const styles: Record<StatusKind, { label: string; pill: string; dot: string }> = {
  paid: {
    label: "Paid",
    pill: "bg-paid-bg text-paid-fg border-paid-border",
    dot: "bg-paid-fg",
  },
  overdue: {
    label: "Overdue",
    pill: "bg-overdue-bg text-overdue-fg border-overdue-border",
    dot: "bg-overdue-fg",
  },
  due: {
    label: "Due",
    pill: "bg-pending-bg text-pending-fg border-pending-border",
    dot: "bg-pending-fg",
  },
  processing: {
    label: "Processing",
    pill: "bg-processing-bg text-processing-fg border-processing-border",
    dot: "bg-processing-fg",
  },
  void: {
    label: "Void",
    pill: "bg-void-bg text-void-fg border-void-border",
    dot: "bg-neutral-400",
  },
};

export function StatusPill({
  kind,
  label,
  className,
}: {
  kind: StatusKind;
  label?: string;
  className?: string;
}) {
  const s = styles[kind];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        s.pill,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", s.dot)} />
      {label ?? s.label}
    </span>
  );
}

/** Derive the visual status of an invoice. "Overdue" is computed, never stored. */
export function invoiceKind(status: string, dueDate: string): StatusKind {
  if (status === "paid") return "paid";
  if (status === "void") return "void";
  if (status === "processing") return "processing";
  const today = new Date().toISOString().slice(0, 10);
  return dueDate < today ? "overdue" : "due";
}
