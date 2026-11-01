import type { OrgScore } from "@/lib/crm/score";

const R = 30;
const C = 2 * Math.PI * R;

function verdict(total: number) {
  if (total >= 70) return "Strong lead";
  if (total >= 45) return "Promising";
  if (total >= 25) return "Worth a look";
  return "Long shot";
}

/** Lead score at a glance: a ring split by what earned the points, and the reasons beside it. */
export function ScoreDonut({ score }: { score: OrgScore }) {
  let offset = 0;
  return (
    <section className="flex gap-4 rounded-xl border bg-card p-3">
      <div className="relative size-[76px] shrink-0">
        <svg viewBox="0 0 76 76" className="size-full -rotate-90" aria-hidden>
          <circle cx="38" cy="38" r={R} fill="none" strokeWidth="9" className="stroke-muted" />
          {score.parts.map((p) => {
            const len = (p.value / 100) * C;
            const el = (
              <circle
                key={p.key}
                cx="38"
                cy="38"
                r={R}
                fill="none"
                stroke={p.color}
                strokeWidth="9"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-xl leading-none">{score.total}</span>
          <span className="text-[10px] text-muted-foreground">/100</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="text-sm font-semibold">
          {verdict(score.total)}
          {score.note && <span className="ml-2 font-normal text-ember">{score.note}</span>}
        </div>
        {score.parts.map((p) => (
          <div key={p.key} className="flex items-baseline gap-2 text-xs">
            <span
              className="mt-0.5 inline-block size-2 shrink-0 rounded-full"
              style={{ background: p.color }}
            />
            <span className="w-[7.5rem] shrink-0 font-medium">
              {p.label} {p.value}/{p.max}
            </span>
            <span className="min-w-0 text-muted-foreground">{p.reason}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
