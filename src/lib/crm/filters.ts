import { STAGES, type OrgType, type Organization, type Stage } from "./types";

export type CrmFilters = {
  stages: Stage[];
  types: OrgType[];
  city: string;
  tag: string;
  q: string;
  dueOnly: boolean;
  /** Lead pipeline statuses to hide; organisations that are not pipeline leads always show. */
  hiddenLeadStatus: LeadStatus[];
};

export const LEAD_STATUSES = ["open", "unverified", "check", "likely-closed"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  open: "Open",
  unverified: "Unverified",
  check: "To check",
  "likely-closed": "Likely closed",
};

/** Status from the import's lead-<status> tag, or null for organisations from other sources. */
export function leadStatus(o: Organization): LeadStatus | null {
  const t = o.tags.find((x) => x.startsWith("lead-"))?.slice(5);
  return LEAD_STATUSES.find((s) => s === t) ?? null;
}

export const DEFAULT_FILTERS: CrmFilters = {
  stages: [...STAGES],
  types: [],
  city: "",
  tag: "",
  q: "",
  dueOnly: false,
  hiddenLeadStatus: ["check", "likely-closed"],
};

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

export function todayIso(now = new Date()) {
  const d = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 10);
}

/** Everything except the stage filter, so the legend can count per stage. */
export function matchesBase(o: Organization, f: CrmFilters, today = todayIso()) {
  if (f.types.length && !f.types.includes(o.type)) return false;
  if (f.city && norm(o.city) !== norm(f.city)) return false;
  if (f.tag && !o.tags.includes(f.tag)) return false;
  const ls = leadStatus(o);
  if (ls && f.hiddenLeadStatus.includes(ls)) return false;
  if (f.dueOnly && !(o.next_step_due && o.next_step_due <= today)) return false;
  if (f.q) {
    const hay = norm(
      [o.name, o.city, o.category, o.owner_name, o.address, o.postcode, o.tags.join(" ")].join(" "),
    );
    if (
      !norm(f.q)
        .split(/\s+/)
        .every((w) => hay.includes(w))
    )
      return false;
  }
  return true;
}

export function applyFilters(orgs: Organization[], f: CrmFilters, today = todayIso()) {
  return orgs.filter((o) => f.stages.includes(o.stage) && matchesBase(o, f, today));
}

export function countByStage(orgs: Organization[], f: CrmFilters, today = todayIso()) {
  const counts = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
  for (const o of orgs) if (matchesBase(o, f, today)) counts[o.stage]++;
  return counts;
}

/** Due first (oldest overdue on top), then undated, newest-updated first. */
export function sortByDue(orgs: Organization[]) {
  return [...orgs].sort((a, b) => {
    if (a.next_step_due && b.next_step_due) return a.next_step_due.localeCompare(b.next_step_due);
    if (a.next_step_due) return -1;
    if (b.next_step_due) return 1;
    return b.updated_at.localeCompare(a.updated_at);
  });
}
