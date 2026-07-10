"use client";

import {
  useId,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

interface FieldChrome {
  label: string;
  hint?: string;
  error?: string;
}

function controlClasses(error?: string) {
  return cn(
    "w-full rounded-md border bg-white px-3 text-sm text-neutral-950 placeholder:text-neutral-400",
    "transition-[border-color,box-shadow] duration-150",
    "focus:outline-none focus:ring-[3px]",
    error
      ? "border-danger-600 focus:border-danger-600 focus:ring-danger-600/15"
      : "border-neutral-300 hover:border-neutral-400 focus:border-pine-600 focus:ring-pine-600/20",
  );
}

function FieldShell({
  id,
  label,
  hint,
  error,
  required,
  children,
}: FieldChrome & { id: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium text-neutral-700">
        {label}
        {required && <span aria-hidden="true" className="text-danger-600"> *</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-[13px] text-danger-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-neutral-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export function Input({
  label,
  hint,
  error,
  className,
  required,
  ...rest
}: FieldChrome & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required}>
      <input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn("h-9.5", controlClasses(error), className)}
        {...rest}
      />
    </FieldShell>
  );
}

/** Text input with a $ prefix; value is a plain string like "350" or "350.25". */
export function MoneyInput({
  label,
  hint,
  error,
  className,
  required,
  ...rest
}: FieldChrome & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required}>
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-neutral-500"
        >
          $
        </span>
        <input
          id={id}
          required={required}
          inputMode="decimal"
          placeholder="350.00"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={cn("h-9.5 pl-7 tabular-nums", controlClasses(error), className)}
          {...rest}
        />
      </div>
    </FieldShell>
  );
}

export function TextArea({
  label,
  hint,
  error,
  className,
  required,
  ...rest
}: FieldChrome & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required}>
      <textarea
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn("min-h-24 py-2 leading-relaxed", controlClasses(error), className)}
        {...rest}
      />
    </FieldShell>
  );
}

export function Select({
  label,
  hint,
  error,
  className,
  required,
  children,
  ...rest
}: FieldChrome & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required}>
      <select
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn("h-9.5 appearance-none pr-8", controlClasses(error), className)}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}
