import type { Currency } from "@/lib/types";
import { convertMinor, ESTIMATE_LABEL, FX_DISCLAIMER, FX_REF_DATE } from "@/lib/fx";
import { amountParts, formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Size = "hero" | "lg" | "md" | "sm";

interface MoneyProps {
  /** Minor units. */
  amount: number;
  currency: Currency;
  size?: Size;
  align?: "start" | "end";
  /** Show a labelled reference-rate estimate in this currency. */
  estimateIn?: Currency;
  /** Show the "Reference rate only…" note under the estimate. */
  note?: boolean;
  tag?: string;
  negative?: boolean;
  className?: string;
}

const amtCls: Record<Size, string> = {
  hero: "font-serif text-3xl",
  lg: "font-serif text-2xl",
  md: "font-serif text-xl",
  sm: "font-sans text-sm font-medium tracking-normal",
};

/**
 * Money, per the Money Rule: converted figures are ALWAYS labelled
 * "≈ estimate · ref. rate <date>", with the disclaimer when `note` is set.
 */
export function Money({ amount, currency, size = "md", align = "start", estimateIn, note, tag, negative, className }: MoneyProps) {
  const { int, dec } = amountParts(amount, currency);
  const est = estimateIn && estimateIn !== currency && amount !== 0 ? formatMoney(convertMinor(amount, currency, estimateIn), estimateIn) : null;
  return (
    <div className={cn("flex flex-col gap-0.5", align === "end" && "items-end text-end", className)}>
      <div className={cn("flex items-baseline gap-2", align === "end" && "justify-end")}>
        <span className={cn("font-sans font-semibold tracking-widest text-muted-foreground", size === "sm" ? "text-[0.6875rem]" : "text-xs")}>{currency}</span>
        <span className={cn("num leading-none tracking-[-0.02em]", amtCls[size], negative && "text-error-ink")}>
          {int}
          {dec && <span className="text-[0.55em] tracking-normal text-muted-foreground">{dec}</span>}
        </span>
        {tag && <span className="inline-flex rounded-full border border-dashed border-rule px-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{tag}</span>}
      </div>
      {est && (
        <div className="num text-xs text-muted-foreground">
          <b className="font-semibold text-foreground">{est}</b> · {ESTIMATE_LABEL} · ref. rate {fmtDate(FX_REF_DATE)}
        </div>
      )}
      {est && note && <div className="max-w-[44ch] text-xs text-muted-foreground">{FX_DISCLAIMER}</div>}
    </div>
  );
}
