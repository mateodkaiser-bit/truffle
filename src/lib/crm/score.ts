import { leadStatus } from "./filters";
import type { Organization, Stage } from "./types";

/** What the team has done with a place, from the interactions table. */
export type OrgActivity = {
  visits: number;
  inbound: number;
  outbound: number;
  last: string | null;
};

export type ScorePart = {
  key: "conversation" | "fit" | "signals" | "reachable" | "timing";
  label: string;
  value: number;
  max: number;
  color: string;
  reason: string;
};
export type OrgScore = { total: number; parts: ScorePart[]; note: string | null };

const GOOD: Stage[] = ["responded", "in_conversation", "pilot_partner"];
const REACHED: Stage[] = [...GOOD, "contacted", "declined"];

const GENERIC = new Set(["restaurant", "cafe", "café", "pub", "bar", "fast food", "pastry shop"]);

/**
 * Features of a place that can be compared with the places that turned out well. Contact
 * details are left out: they say how we reached a place, not whether it was a good fit.
 */
function features(o: Organization, now = new Date()): string[] {
  const f: string[] = [];
  for (const c of (o.category ?? "").toLowerCase().split(/[,;/]/)) {
    const t = c.trim();
    // Spotmapper put addresses or the bare place type in this field: skip both.
    if (t && t.length <= 24 && !/\d|netherlands|nederland/.test(t) && !GENERIC.has(t))
      f.push(`category:${t}`);
  }
  if (o.city) f.push(`city:${o.city.replace(/\s*\(.*\)$/, "")}`);
  for (const p of (o.pos_hint ?? "").toLowerCase().split(/,\s*/))
    if (p && !/not named|unknown/.test(p)) f.push(`pos:${p}`);
  if (o.pitch_angle && o.tags.includes("price-insight")) f.push("has:price insight");
  if (o.opened_year && o.opened_year >= now.getFullYear() - 3) f.push("young");
  const ls = leadStatus(o);
  if (ls) f.push(`lead:${ls}`);
  // Restaurants learn from restaurants, suppliers from suppliers.
  return f.map((k) => `${o.type}|${k}`);
}

const FEATURE_LABEL = (k: string) =>
  k
    .replace(/^[^|]*\|/, "")
    .replace(/^(category|city|pos):/, "")
    .replace(/^has:/, "has ")
    .replace(/^lead:/, "")
    .replace("young", "opened recently");

export type ScoreModel = { lift: Map<string, number>; good: number; reached: number };

function isGood(o: Organization, a?: OrgActivity) {
  return GOOD.includes(o.stage) || (!!a?.visits && o.stage !== "declined");
}

/**
 * Learns from the places the team already reached: a feature shared by places that replied or
 * had a good visit gets a lift above 1, one shared by places that said no gets a lift below 1.
 * Only features seen at 3 or more reached places count. Laplace smoothing keeps small counts calm.
 */
export function learnFromHistory(
  orgs: Organization[],
  activity: Map<string, OrgActivity>,
): ScoreModel {
  const good = new Map<string, number>();
  const seen = new Map<string, number>();
  let nGood = 0;
  let nReached = 0;
  for (const o of orgs) {
    const a = activity.get(o.id);
    if (!REACHED.includes(o.stage) && !a?.visits) continue;
    nReached++;
    const g = isGood(o, a);
    if (g) nGood++;
    for (const k of new Set(features(o))) {
      seen.set(k, (seen.get(k) ?? 0) + 1);
      if (g) good.set(k, (good.get(k) ?? 0) + 1);
    }
  }
  const lift = new Map<string, number>();
  for (const [k, n] of seen) {
    if (n < 3) continue;
    const pGood = ((good.get(k) ?? 0) + 1) / (nGood + 2);
    const pAll = (n + 1) / (nReached + 2);
    lift.set(k, pGood / pAll);
  }
  return { lift, good: nGood, reached: nReached };
}

const clamp = (v: number, max: number) => Math.max(0, Math.min(max, Math.round(v)));

/**
 * Score from 0 to 100 and the reasons behind it. A good conversation outweighs everything
 * (up to 50), then how much this place looks like the ones that replied before (15), the lead
 * pipeline's own signals (15), how easy they are to reach (10) and timing (10).
 */
export function scoreOrg(
  o: Organization,
  a: OrgActivity | undefined,
  model: ScoreModel,
  now = new Date(),
): OrgScore {
  // 1. Conversation
  let conv = 0;
  const convWhy: string[] = [];
  if (o.stage === "pilot_partner") {
    conv = 50;
    convWhy.push("pilot or partner");
  } else if (o.stage === "in_conversation") {
    conv = 44;
    convWhy.push("in conversation");
  } else if (o.stage === "responded") {
    conv = 32;
    convWhy.push("they responded");
  } else if (o.stage === "contacted") {
    conv = 8;
    convWhy.push("contacted, no reply yet");
  }
  // A visit is a conversation even when nobody moved the stage on afterwards.
  if (a?.visits && o.stage !== "declined" && conv < 26) {
    conv = 26;
    convWhy.splice(0, convWhy.length);
  }
  if (o.stage !== "declined") {
    if (a?.inbound) {
      conv += 6;
      convWhy.push(`${a.inbound} message${a.inbound > 1 ? "s" : ""} from them`);
    }
    if (a?.visits) {
      conv += 6;
      convWhy.push(`visited ${a.visits}×`);
    }
  }
  if (!convWhy.length) convWhy.push("no contact yet");

  // 2. Looks like past wins
  const known = features(o, now)
    .map((k) => [k, model.lift.get(k)] as const)
    .filter((x): x is readonly [string, number] => x[1] != null);
  const meanLog = known.length ? known.reduce((s, [, l]) => s + Math.log2(l), 0) / known.length : 0;
  const fit = model.good >= 3 ? 7.5 + 7.5 * Math.tanh(meanLog * 1.5) : 7.5;
  const best = [...known].sort((x, y) => y[1] - x[1]).filter(([, l]) => l > 1.15);
  const worst = [...known].sort((x, y) => x[1] - y[1]).filter(([, l]) => l < 0.85);
  const fitWhy =
    model.good < 3
      ? "not enough replies yet to learn from"
      : best.length
        ? `like places that replied: ${best
            .slice(0, 3)
            .map(([k]) => FEATURE_LABEL(k))
            .join(", ")}`
        : worst.length
          ? `unlike places that replied: ${worst
              .slice(0, 2)
              .map(([k]) => FEATURE_LABEL(k))
              .join(", ")}`
          : "average for places we reached";

  // 3. Lead signals
  const pipeline = Number(o.notes?.match(/Lead score (\d+)/)?.[1]);
  const priority = Number(o.tags.find((t) => /^priority-\d$/.test(t))?.slice(9));
  let signals = 0;
  let sigWhy = "no lead signals";
  if (pipeline) {
    signals = (pipeline / 15) * 15;
    sigWhy = `pipeline score ${pipeline}`;
  } else if (priority) {
    signals = [0, 13, 9, 6][priority] ?? 4;
    sigWhy = `priority ${priority} lead`;
  } else if (o.hook) {
    signals = 5;
    sigWhy = "has a reason to fit";
  }
  if (o.tags.includes("price-insight")) {
    signals += 2;
    sigWhy += ", price opener ready";
  }

  // 4. Reachable
  const ways = [
    o.email && ["email", 4],
    o.phone && ["phone", 3],
    o.website && ["website", 2],
    o.instagram && ["Instagram", 1],
  ].filter(Boolean) as [string, number][];
  const reach = ways.reduce((s, [, v]) => s + v, 0);

  // 5. Timing: young and open now
  let timing = 0;
  const timeWhy: string[] = [];
  const age = o.opened_year ? now.getFullYear() - o.opened_year : null;
  if (age != null && age <= 2) {
    timing += 6;
    timeWhy.push(`opened ${o.opened_year}`);
  } else if (age != null && age <= 5) {
    timing += 3;
    timeWhy.push(`opened ${o.opened_year}`);
  }
  const ls = leadStatus(o);
  if (ls === "open") {
    timing += 4;
    timeWhy.push("open now");
  } else if (ls === "unverified") {
    timing += 1;
    timeWhy.push("not yet confirmed open");
  }

  const parts: ScorePart[] = [
    {
      key: "conversation",
      label: "Conversation",
      value: clamp(conv, 50),
      max: 50,
      color: "#16A34A",
      reason: convWhy.join(", "),
    },
    {
      key: "fit",
      label: "Like past wins",
      value: clamp(fit, 15),
      max: 15,
      color: "#8B5CF6",
      reason: fitWhy,
    },
    {
      key: "signals",
      label: "Lead signals",
      value: clamp(signals, 15),
      max: 15,
      color: "#3B82F6",
      reason: sigWhy,
    },
    {
      key: "reachable",
      label: "Reachable",
      value: clamp(reach, 10),
      max: 10,
      color: "#F59E0B",
      reason: ways.length ? ways.map(([w]) => w).join(", ") : "no contact details",
    },
    {
      key: "timing",
      label: "Timing",
      value: clamp(timing, 10),
      max: 10,
      color: "#0E9F8E",
      reason: timeWhy.join(", ") || "opening year unknown",
    },
  ];
  let total = parts.reduce((s, p) => s + p.value, 0);
  let note: string | null = null;
  if (o.stage === "declined") {
    total = Math.min(total, 15);
    note = `Declined${o.declined_reason ? `: ${o.declined_reason}` : ""}`;
  }
  if (o.do_not_contact) note = "Do not contact by automation";
  return { total, parts, note };
}
