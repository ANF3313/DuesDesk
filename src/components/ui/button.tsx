import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { IconSpinner } from "./icons";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "border-transparent bg-pine-600 text-white hover:bg-pine-700 active:bg-pine-800",
  secondary:
    "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400 hover:bg-neutral-50 active:bg-neutral-100",
  ghost:
    "border-transparent bg-transparent text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200",
  danger:
    "border-transparent bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-700",
};

const sizes: Record<Size, string> = {
  sm: "h-8 gap-1.5 px-3 text-[13px]",
  md: "h-9.5 gap-2 px-4 text-sm",
  lg: "h-11 gap-2 px-5 text-[15px]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "primary", size = "md", loading, className, children, disabled, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex select-none items-center justify-center whitespace-nowrap rounded-md border font-medium",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-600 focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className,
        )}
        {...rest}
      >
        {loading && <IconSpinner width={16} height={16} />}
        {children}
      </button>
    );
  },
);
