import { sortByDue, todayIso } from "@/lib/crm/filters";
import { STAGE_META, TYPE_LABEL } from "@/lib/crm/stages";
import type { Organization } from "@/lib/crm/types";
import { StageDot } from "./org-card";

/** Same data as the map, sorted by next-step due date so the top of the list is today's work. */
export function OrgList({
  orgs,
  onSelect,
}: {
  orgs: Organization[];
  onSelect: (id: string) => void;
}) {
  const today = todayIso();
  const rows = sortByDue(orgs).slice(0, 500);
  if (!rows.length)
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        Nothing matches these filters.
      </p>
    );
  return (
    <ul className="divide-y">
      {rows.map((o) => {
        const overdue = o.next_step_due && o.next_step_due < today;
        const dueToday = o.next_step_due === today;
        return (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => onSelect(o.id)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/60"
            >
              <StageDot stage={o.stage} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{o.name}</span>
                  {o.next_step_due && (
                    <span
                      className={`shrink-0 text-xs ${overdue ? "font-semibold text-ember" : dueToday ? "font-semibold" : "text-muted-foreground"}`}
                    >
                      {dueToday ? "Today" : o.next_step_due}
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {STAGE_META[o.stage].label} · {TYPE_LABEL[o.type]}
                  {o.city && ` · ${o.city}`}
                </div>
                {o.next_step && <div className="mt-0.5 truncate text-sm">{o.next_step}</div>}
              </div>
            </button>
          </li>
        );
      })}
      {orgs.length > rows.length && (
        <li className="p-4 text-center text-xs text-muted-foreground">
          Showing 500 of {orgs.length}. Narrow the filters to see the rest.
        </li>
      )}
    </ul>
  );
}
