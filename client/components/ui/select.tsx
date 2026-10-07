"use client";

import * as React from "react";
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/* shadcn/ui Select, styled with the Paylancr tokens (see app/globals.css). */

function Select(props: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup(props: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue(props: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-rule bg-surface px-3 text-start text-base text-foreground whitespace-nowrap hover:border-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-error data-[placeholder]:text-muted-foreground *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 text-muted-foreground" aria-hidden="true" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({ className, children, position = "popper", ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        className={cn(
          "relative z-50 max-h-(--radix-select-content-available-height) min-w-32 origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-lg border border-rule bg-popover text-popover-foreground",
          position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
          className,
        )}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport className={cn("p-1.5", position === "popper" && "w-full min-w-(--radix-select-trigger-width)")}>
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return <SelectPrimitive.Label data-slot="select-label" className={cn("t-eyebrow px-3 py-2", className)} {...props} />;
}

function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-md ps-3 pe-8 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[highlighted]:bg-hover data-[state=checked]:font-semibold",
        className,
      )}
      {...props}
    >
      <span className="absolute end-2 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4 text-primary-ink" aria-hidden="true" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return <SelectPrimitive.Separator data-slot="select-separator" className={cn("pointer-events-none my-1 h-px bg-border", className)} {...props} />;
}

function SelectScrollUpButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton data-slot="select-scroll-up-button" className={cn("flex cursor-default items-center justify-center py-1", className)} {...props}>
      <ChevronUpIcon className="size-4" aria-hidden="true" />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton data-slot="select-scroll-down-button" className={cn("flex cursor-default items-center justify-center py-1", className)} {...props}>
      <ChevronDownIcon className="size-4" aria-hidden="true" />
    </SelectPrimitive.ScrollDownButton>
  );
}

/* ---- Option-list convenience layer ------------------------------------------------------------ */

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

/** Radix forbids `value=""` on items, so an empty option is mapped to this sentinel and back. */
const EMPTY = "__empty__";
const toRadix = (v: string) => (v === "" ? EMPTY : v);
const fromRadix = (v: string) => (v === EMPTY ? "" : v);

export interface SelectFieldProps {
  id?: string;
  name?: string;
  value: string;
  onValueChange: (value: string) => void;
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
  options: SelectOption[];
  /** Shown when `value` matches no option (e.g. a "Choose a type…" prompt). */
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/** One-line shadcn Select over an options array. `className` styles the trigger. */
export const SelectField = React.forwardRef<HTMLButtonElement, SelectFieldProps>(function SelectField(
  { id, name, value, onValueChange, onBlur, options, placeholder, disabled, autoComplete, className, ...aria },
  ref,
) {
  const hasValue = options.some((o) => o.value === value);
  return (
    <Select
      name={name}
      value={hasValue ? toRadix(value) : ""}
      onValueChange={(v) => onValueChange(fromRadix(v))}
      disabled={disabled}
      autoComplete={autoComplete}
    >
      <SelectTrigger ref={ref} id={id} onBlur={onBlur} className={className} {...aria}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={toRadix(o.value)} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});

type FormSelectProps<T extends FieldValues> = Omit<SelectFieldProps, "value" | "onValueChange" | "onBlur" | "name"> & {
  control: Control<T>;
  name: FieldPath<T>;
  /** Runs after the form value is updated (e.g. to derive another field). */
  onChange?: (value: string) => void;
};

/** `SelectField` bound to react-hook-form (Radix Select can't use `register`). */
export function FormSelect<T extends FieldValues>({ control, name, onChange, ...props }: FormSelectProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <SelectField
          {...props}
          ref={field.ref}
          name={field.name}
          value={field.value == null ? "" : String(field.value)}
          onBlur={field.onBlur}
          onValueChange={(v) => {
            field.onChange(v);
            onChange?.(v);
          }}
          disabled={props.disabled || field.disabled}
        />
      )}
    />
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
