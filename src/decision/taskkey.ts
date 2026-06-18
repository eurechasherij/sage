import { createHash } from "node:crypto";

export interface TaskRef {
  /** ticket id parsed from the /work argument (preferred) */
  ticket?: string;
  /** current git branch (fallback) */
  branch?: string;
  /** the raw ticket/breakdown text (last-resort hash, also used for binding) */
  text?: string;
}

export const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

/** Stable, filesystem-safe key naming the decision artifact for a task. */
export const taskKey = (ref: TaskRef): string => {
  if (ref.ticket) return slug(ref.ticket);
  if (ref.branch) return slug(ref.branch);
  if (ref.text) return `task-${sha256(ref.text).slice(0, 12)}`;
  return "task-unknown";
}

function slug(s: string): string {
  const out = s
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return out || "task";
}
