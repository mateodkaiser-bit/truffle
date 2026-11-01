import { describe, expect, it } from "vitest";
import { DEMO_BASE } from "./demo";
import { learnFromHistory, scoreOrg, type OrgActivity } from "./score";
import type { Organization } from "./types";

const now = new Date("2026-11-01");
let n = 0;
const org = (patch: Partial<Organization>): Organization =>
  ({ ...DEMO_BASE, id: `o${++n}`, name: `Place ${n}`, ...patch }) as Organization;

describe("lead score", () => {
  it("ranks a good conversation above a strong cold lead", () => {
    const model = learnFromHistory([], new Map());
    const talking = org({ stage: "in_conversation", email: "a@b.nl" });
    const cold = org({
      stage: "enriched",
      email: "a@b.nl",
      phone: "1",
      website: "x",
      notes: "Lead score 15.",
      opened_year: 2026,
      tags: ["lead-open"],
    });
    expect(scoreOrg(talking, undefined, model, now).total).toBeGreaterThan(
      scoreOrg(cold, undefined, model, now).total,
    );
  });

  it("caps declined places and says why", () => {
    const model = learnFromHistory([], new Map());
    const s = scoreOrg(
      org({ stage: "declined", declined_reason: "No time", email: "a@b.nl" }),
      undefined,
      model,
      now,
    );
    expect(s.total).toBeLessThanOrEqual(15);
    expect(s.note).toContain("No time");
  });

  it("learns which features the places that replied share", () => {
    const orgs = [
      ...[1, 2, 3, 4].map(() => org({ stage: "responded", city: "Rotterdam" })),
      ...[1, 2, 3, 4].map(() => org({ stage: "declined", city: "Utrecht" })),
    ];
    const model = learnFromHistory(orgs, new Map<string, OrgActivity>());
    const fit = (city: string) =>
      scoreOrg(org({ stage: "enriched", city }), undefined, model, now).parts.find(
        (p) => p.key === "fit",
      )!;
    expect(fit("Rotterdam").value).toBeGreaterThan(fit("Utrecht").value);
    expect(fit("Rotterdam").reason).toContain("Rotterdam");
  });

  it("counts a visit as a conversation", () => {
    const model = learnFromHistory([], new Map());
    const o = org({ stage: "responded" });
    const visited = scoreOrg(o, { visits: 1, inbound: 0, outbound: 0, last: null }, model, now);
    expect(visited.parts[0]!.reason).toContain("visited");
    expect(visited.parts[0]!.value).toBeGreaterThan(
      scoreOrg(o, undefined, model, now).parts[0]!.value,
    );
  });
});
