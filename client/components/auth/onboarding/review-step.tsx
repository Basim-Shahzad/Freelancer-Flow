"use client";

import { StageThread } from "@/components/domain/stage-thread";
import { Button } from "@/components/ui/button";
import { buildSummary, type OnboardingData } from "../onboarding-logic";

export function ReviewStep({ data, busy, onBack, onFinish }: {
  data: OnboardingData; busy: "dashboard" | "project" | null; onBack: () => void; onFinish: (to: "/dashboard" | "/projects/new") => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <dl className="m-0 border-t border-border">
        {buildSummary(data).map((r) => (
          <div key={r.k} className="grid grid-cols-[minmax(6rem,10rem)_minmax(0,1fr)] gap-4 border-b border-border py-3.5">
            <dt className="t-eyebrow self-center">{r.k}</dt>
            <dd className="m-0 font-medium">{r.v}</dd>
          </div>
        ))}
      </dl>
      <StageThread stage="work" caption="Every project follows this thread. Next: create a project, track time, then invoice from it." animate={false} />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={onBack} disabled={busy !== null}>Back</Button>
        <Button loading={busy === "dashboard"} disabled={busy === "project"} onClick={() => onFinish("/dashboard")}>Go to dashboard</Button>
        <Button variant="outline" loading={busy === "project"} disabled={busy === "dashboard"} onClick={() => onFinish("/projects/new")}>Create your first project</Button>
      </div>
    </div>
  );
}
