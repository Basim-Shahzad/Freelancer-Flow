import Link from "next/link";
import { Pips, Progress } from "@/components/ui/progress";
import { Card, CardBody, CardHead } from "@/components/ui/section";
import { BILLING_LABEL, STAGE_LABEL, stagePips, type ProgressInfo, type StageInfo } from "@/components/projects/logic";
import type { Project } from "@/lib/types";

export interface ActiveProjectRow { project: Project; clientName: string; stage: StageInfo; progress: ProgressInfo | null }

/** Projects in progress, with milestone / retainer-period / manual progress. */
export function ProjectsSection({ rows, className }: { rows: ActiveProjectRow[]; className?: string }) {
  return (
    <Card className={className}>
      <CardHead title="Active projects" sub="Where each one sits, work to paid" action={<Link href="/projects" className="inline-flex min-h-11 items-center text-sm font-medium text-primary-ink underline decoration-1 underline-offset-[3px]">All</Link>} />
      <CardBody className="py-1">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active projects. <Link href="/projects/new" className="font-medium text-primary-ink underline underline-offset-[3px]">Start one</Link> to track progress here.</p>
      ) : (
        <div>
          {rows.map(({ project, clientName, stage, progress }) => (
            <Link key={project.id} href={`/projects/${project.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 border-b border-border py-4 text-inherit no-underline hover:bg-hover">
              <div className="min-w-0">
                <div className="font-semibold leading-snug">{project.name}</div>
                <div className="text-xs leading-snug text-muted-foreground">{clientName} · {BILLING_LABEL[project.billingType]}</div>
              </div>
              <Pips states={stagePips(stage.stage)} label={`Stage: ${STAGE_LABEL[stage.stage]}`} />
              <div className="col-span-full flex flex-col gap-1.5">
                {progress ? (
                  <>
                    <Progress value={progress.pct} label={`${project.name} progress`} />
                    <span className="num text-xs text-muted-foreground">{progress.pct}% · {progress.basis}</span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">Ongoing · {stage.caption}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
      </CardBody>
    </Card>
  );
}
