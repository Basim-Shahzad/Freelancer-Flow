import type { ApiChangeRequestStatus, ChangeRequestCreate, ChangeRequestResponse, ChangeRequestUpdate } from "@/lib/api/change-requests.types";
import { toDecimal, toMinor } from "@/lib/api/money";
import type { ChangeRequest, ChangeRequestStatus, Currency } from "@/lib/types";

export const changeRequestStatusFromApi = (s: ApiChangeRequestStatus): ChangeRequestStatus => s.toLowerCase() as ChangeRequestStatus;
export const changeRequestStatusToApi = (s: ChangeRequestStatus): ApiChangeRequestStatus => s.toUpperCase() as ApiChangeRequestStatus;

/** Hours as the API wants them: a decimal string with at most 2 places, no float math. */
const hoursToWire = (h: number) => h.toFixed(2);

export function responseToChangeRequest(r: ChangeRequestResponse, currency: Currency): ChangeRequest {
  return {
    id: r.id,
    projectId: r.projectId,
    title: r.title,
    description: r.description ?? "",
    status: changeRequestStatusFromApi(r.status),
    estimatedHours: r.estimatedHours === null ? undefined : Number(r.estimatedHours),
    estimatedAmount: r.estimatedAmount === null ? undefined : toMinor(r.estimatedAmount, currency),
    requestedAt: r.requestedAt,
    decidedAt: r.decidedAt ?? undefined,
    decisionNote: r.decisionNote ?? undefined,
  };
}

/** The editable fields, as the scope-change form holds them. */
export interface ChangeRequestInput {
  title: string;
  description: string;
  estimatedHours?: number;
  /** Minor units; undefined = unpriced. */
  estimatedAmount?: number;
}

export function changeRequestToInput(c: ChangeRequest): ChangeRequestInput {
  return { title: c.title, description: c.description, estimatedHours: c.estimatedHours, estimatedAmount: c.estimatedAmount };
}

function toWire(c: ChangeRequestInput, currency: Currency) {
  const description = c.description.trim();
  return {
    title: c.title.trim(),
    description: description === "" ? null : description,
    estimatedHours: c.estimatedHours === undefined ? null : hoursToWire(c.estimatedHours),
    estimatedAmount: c.estimatedAmount === undefined ? null : toDecimal(c.estimatedAmount, currency),
  };
}

export function changeRequestToCreate(projectId: string, c: ChangeRequestInput, currency: Currency): ChangeRequestCreate {
  return { projectId, ...toWire(c, currency) };
}

/** PATCH body with only the fields that differ from `previous`. */
export function changeRequestToUpdate(next: ChangeRequestInput, previous: ChangeRequestInput, currency: Currency): ChangeRequestUpdate {
  const full = toWire(next, currency);
  const before = toWire(previous, currency);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(full) as (keyof typeof full)[]) {
    if (full[key] !== before[key]) out[key] = full[key];
  }
  return out as ChangeRequestUpdate;
}

/** PATCH body recording a decision; a blank note is omitted (the server rejects a note without a decision, not a decision without one). */
export function decisionToUpdate(status: Exclude<ChangeRequestStatus, "pending">, note?: string): ChangeRequestUpdate {
  const trimmed = note?.trim() ?? "";
  return trimmed === "" ? { status: changeRequestStatusToApi(status) } : { status: changeRequestStatusToApi(status), decisionNote: trimmed };
}
