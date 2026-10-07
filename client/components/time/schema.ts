import { z } from "zod";
import { parseDuration } from "@/lib/money";

/** Add / edit time entry form. `duration` is free text parsed with parseDuration. */
export const entrySchema = z.object({
  description: z.string().trim().min(1, "Describe what you worked on"),
  /** "" = no project (internal). */
  projectId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  duration: z.string().refine((v) => {
    const m = parseDuration(v);
    return m !== null && m > 0 && m <= 24 * 60;
  }, "Enter a duration between 1 minute and 24 hours, like 1.5, 1:30 or 90m"),
  /** "" = not set. */
  startTime: z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d)?$/, "Use a time like 09:30"),
  billable: z.boolean(),
});

export type EntryFormValues = z.infer<typeof entrySchema>;
