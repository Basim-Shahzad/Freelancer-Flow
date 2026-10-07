import { Button } from "@/components/ui/button";

/** Back / primary / optional skip row shared by every step. */
export function StepActions({ onBack, onSkip, primary, loading, children }: {
  onBack?: () => void; onSkip?: () => void; primary?: string; loading?: boolean; children?: React.ReactNode;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      {onBack && <Button variant="ghost" onClick={onBack}>Back</Button>}
      {primary && <Button type="submit" loading={loading}>{primary}</Button>}
      {children}
      {onSkip && <Button variant="ghost" onClick={onSkip}>Skip for now</Button>}
    </div>
  );
}

export const FORM_GRID = "grid grid-cols-[repeat(auto-fit,minmax(min(14rem,100%),1fr))] gap-x-4 gap-y-5";
