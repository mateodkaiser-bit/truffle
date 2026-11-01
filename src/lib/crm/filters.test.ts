import { describe, expect, it } from "vitest";
import { stageAfter } from "./api";
import { DEMO_ORGS } from "./demo";
import { applyFilters, countByStage, DEFAULT_FILTERS, sortByDue } from "./filters";

const today = "2026-11-04";

describe("crm filters", () => {
  it("hides a stage but still counts it for the legend", () => {
    const f = {
      ...DEFAULT_FILTERS,
      stages: DEFAULT_FILTERS.stages.filter((s) => s !== "declined"),
    };
    expect(applyFilters(DEMO_ORGS, f, today).some((o) => o.stage === "declined")).toBe(false);
    expect(countByStage(DEMO_ORGS, f, today).declined).toBe(1);
  });

  it("hides pipeline leads by status but always shows other organisations", () => {
    const f = { ...DEFAULT_FILTERS, hiddenLeadStatus: ["unverified" as const] };
    const names = applyFilters(DEMO_ORGS, f, today).map((o) => o.name);
    expect(names).not.toContain("Eethuis Noorderlicht");
    expect(names).toContain("Restaurant Gras");
    expect(names).toContain("Koffiebranderij Zuidwind");
  });

  it("hides fresh pipeline leads with the layer toggle and filters by score", () => {
    const marks = { visited: new Set<string>(), promising: new Set<string>() };
    const off = { ...DEFAULT_FILTERS, showPipeline: false, hiddenLeadStatus: [] };
    const names = applyFilters(DEMO_ORGS, off, today, marks).map((o) => o.name);
    expect(names).not.toContain("Restaurant Gras");
    expect(names).toContain("Koffiebranderij Zuidwind");
    const scores = new Map(DEMO_ORGS.map((o) => [o.id, o.name === "Restaurant Gras" ? 55 : 10]));
    const top = { ...DEFAULT_FILTERS, minScore: 50, hiddenLeadStatus: [] };
    expect(applyFilters(DEMO_ORGS, top, today, { ...marks, scores }).map((o) => o.name)).toEqual([
      "Restaurant Gras",
    ]);
  });

  it("matches search words in any order, ignoring accents and case", () => {
    const f = { ...DEFAULT_FILTERS, q: "zuidwind KOFFIE" };
    expect(applyFilters(DEMO_ORGS, f, today).map((o) => o.name)).toEqual([
      "Koffiebranderij Zuidwind",
    ]);
  });

  it("due-only keeps next steps due today or earlier", () => {
    const f = { ...DEFAULT_FILTERS, dueOnly: true };
    expect(applyFilters(DEMO_ORGS, f, today).map((o) => o.next_step_due)).toEqual([
      "2026-11-03",
      "2026-11-04",
    ]);
  });

  it("sorts by due date with undated rows last", () => {
    const sorted = sortByDue(DEMO_ORGS);
    expect(sorted[0]?.next_step_due).toBe("2026-11-03");
    expect(sorted.at(-1)?.next_step_due).toBeNull();
  });

  it("moves a stage forward on a logged interaction, never backward", () => {
    expect(stageAfter("researched", "out")).toBe("contacted");
    expect(stageAfter("contacted", "in")).toBe("responded");
    expect(stageAfter("in_conversation", "out")).toBe("in_conversation");
    expect(stageAfter("declined", "in")).toBe("declined");
  });
});
