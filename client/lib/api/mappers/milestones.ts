import { toDecimal, toMinor } from "@/lib/api/money";
import { apiDateToIso, isoToApiDateTime } from "@/lib/api/mappers/projects";
import type { ApiMilestoneStatus, MilestoneCreate, MilestoneResponse, MilestoneUpdate } from "@/lib/api/projects.types";
import type { Currency, Milestone, MilestoneStatus } from "@/lib/types";

export const milestoneStatusFromApi = (s: ApiMilestoneStatus): MilestoneStatus => s.toLowerCase() as MilestoneStatus;
export const milestoneStatusToApi = (s: MilestoneStatus): ApiMilestoneStatus => s.toUpperCase() as ApiMilestoneStatus;

export function responseToMilestone(r: MilestoneResponse, currency: Currency): Milestone {
  return {
    id: r.id,
    projectId: r.projectId,
    title: r.name,
    description: r.description ?? "",
    amount: r.amount === null ? undefined : toMinor(r.amount, currency),
    dueDate: apiDateToIso(r.dueDate),
    status: milestoneStatusFromApi(r.status),
    approvalRequired: r.approvalRequired,
    sortOrder: r.sortOrder,
    submittedAt: r.submittedAt ?? undefined,
    approvedAt: r.approvedAt ?? undefined,
  };
}

/** The editable fields, as the milestone form holds them. */
export interface MilestoneInput {
  title: string;
  description: string;
  /** Minor units; undefined = no money on this milestone. */
  amount?: number;
  dueDate?: string;
  approvalRequired: boolean;
}

export function milestoneToInput(m: Milestone): MilestoneInput {
  return { title: m.title, description: m.description, amount: m.amount, dueDate: m.dueDate, approvalRequired: m.approvalRequired };
}

function toWire(m: MilestoneInput, currency: Currency) {
  const description = m.description.trim();
  return {
    name: m.title.trim(),
    description: description === "" ? null : description,
    amount: m.amount === undefined ? null : toDecimal(m.amount, currency),
    dueDate: m.dueDate ? isoToApiDateTime(m.dueDate) : null,
    approvalRequired: m.approvalRequired,
  };
}

export function milestoneToCreate(projectId: string, m: MilestoneInput, currency: Currency): MilestoneCreate {
  return { projectId, ...toWire(m, currency) };
}

/** PATCH body with only the fields that differ from `previous`. */
export function milestoneToUpdate(next: MilestoneInput, previous: MilestoneInput, currency: Currency): MilestoneUpdate {
  const full = toWire(next, currency);
  const before = toWire(previous, currency);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(full) as (keyof typeof full)[]) {
    if (full[key] !== before[key]) out[key] = full[key];
  }
  return out as MilestoneUpdate;
}

/** Moves one item and returns the new order (the input is not mutated). */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return [...items];
  const out = [...items];
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item as T);
  return out;
}
