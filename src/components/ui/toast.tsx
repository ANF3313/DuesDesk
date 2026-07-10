"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/cn";
import { IconAlert, IconCheck, IconX } from "./icons";

type Toast = {
  id: number;
  title: string;
  description?: string;
  kind: "success" | "error";
};

type ToastInput = Omit<Toast, "id" | "kind"> & { kind?: Toast["kind"] };

const ToastContext = createContext<{ toast: (t: ToastInput) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      setToasts((t) => [...t, { id, kind: "success", ...input }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        role="status"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex animate-slide-up items-start gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-pop"
          >
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                t.kind === "success"
                  ? "bg-paid-bg text-paid-fg"
                  : "bg-overdue-bg text-overdue-fg",
              )}
            >
              {t.kind === "success" ? (
                <IconCheck width={12} height={12} strokeWidth={2.4} />
              ) : (
                <IconAlert width={13} height={13} strokeWidth={2} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-neutral-950">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 text-[13px] leading-snug text-neutral-600">
                  {t.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="rounded p-1 text-neutral-400 transition-colors hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-600"
            >
              <IconX width={14} height={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
