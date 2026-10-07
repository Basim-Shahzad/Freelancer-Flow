import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full border border-transparent px-4 text-sm font-semibold leading-none no-underline transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45 [&_svg]:size-[1.125em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--primary)_88%,var(--foreground))]",
        outline: "border-rule bg-transparent text-foreground hover:bg-hover",
        ghost: "text-foreground hover:bg-hover",
        destructive: "border-[color-mix(in_srgb,var(--error)_55%,var(--border))] bg-transparent text-error-ink hover:bg-error-tint",
        /** No colour or hover of its own: for buttons whose look comes entirely from className (heat cells, time blocks). */
        bare: "rounded-none p-0 font-normal leading-normal whitespace-normal",
        link: "min-h-0 rounded-none px-0 font-medium text-primary-ink underline decoration-1 underline-offset-[3px]",
      },
      size: {
        default: "",
        sm: "min-h-9 px-3 text-xs",
        icon: "w-11 px-0",
        "icon-sm": "min-h-9 w-9 px-0 text-xs",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "default", block: false },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild = false, loading, children, disabled, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, block }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...(asChild ? {} : { type: type ?? "button" })}
        {...props}
      >
        {asChild ? children : (<>{loading && <Spinner />}{children}</>)}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("size-[1.125em] animate-[spin_0.9s_linear_infinite]", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}
