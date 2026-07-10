export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50/60 px-6 py-14 text-center">
      {icon && (
        <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-pine-50 text-pine-600">
          {icon}
        </div>
      )}
      <h3 className="text-[15px] font-semibold text-neutral-950">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-neutral-500">
        {body}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
