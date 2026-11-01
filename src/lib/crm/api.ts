import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_BASE, DEMO_CONTACTS, DEMO_INTERACTIONS, DEMO_ORGS } from "./demo";
import type { Contact, CrmDatabase, Interaction, Organization, Stage } from "./types";

// The generated Database type does not know the CRM tables until Lovable regenerates it.
const db = supabase as unknown as SupabaseClient<CrmDatabase>;

// Demo mode keeps everything in memory with synthetic rows (dev server only).
let demo = false;
const demoStore = {
  orgs: DEMO_ORGS.map((o) => ({ ...o })),
  contacts: [...DEMO_CONTACTS],
  interactions: [...DEMO_INTERACTIONS],
};
export function setDemoMode(on: boolean) {
  demo = on;
}
export const isDemoMode = () => demo;

const PAGE = 1000;

async function fetchOrgs(): Promise<Organization[]> {
  if (demo) return demoStore.orgs.map((o) => ({ ...o }));
  const out: Organization[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("organizations")
      .select("*")
      .order("name")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data as Organization[]));
    if (!data || data.length < PAGE) return out;
  }
}

export function useOrgs(enabled: boolean) {
  return useQuery({ queryKey: ["crm", "orgs"], queryFn: fetchOrgs, enabled, staleTime: 60_000 });
}

export function useOrgDetail(orgId: string | null) {
  return useQuery({
    queryKey: ["crm", "detail", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<{ contacts: Contact[]; interactions: Interaction[] }> => {
      if (demo) {
        return {
          contacts: demoStore.contacts.filter((c) => c.org_id === orgId),
          interactions: demoStore.interactions
            .filter((i) => i.org_id === orgId)
            .sort((a, b) => b.date.localeCompare(a.date)),
        };
      }
      const [c, i] = await Promise.all([
        db.from("contacts").select("*").eq("org_id", orgId!).order("name"),
        db
          .from("interactions")
          .select("*")
          .eq("org_id", orgId!)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);
      if (c.error) throw c.error;
      if (i.error) throw i.error;
      return { contacts: c.data as Contact[], interactions: i.data as Interaction[] };
    },
  });
}

export type OrgPatch = Partial<Omit<Organization, "id" | "created_at" | "updated_at">>;

async function patchOrg(id: string, patch: OrgPatch) {
  if (demo) {
    const o = demoStore.orgs.find((x) => x.id === id);
    if (o) Object.assign(o, patch, { updated_at: new Date().toISOString() });
    return;
  }
  const { error } = await db.from("organizations").update(patch).eq("id", id);
  if (error) throw error;
}

export function useUpdateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: OrgPatch }) => patchOrg(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "orgs"] }),
  });
}

export type NewInteraction = Pick<Interaction, "org_id" | "channel" | "direction" | "date"> &
  Partial<
    Pick<
      Interaction,
      "contact_id" | "subject" | "summary" | "next_step" | "next_step_due" | "people"
    >
  >;

/** Stage a logged interaction moves an organisation to, if it is earlier in the pipeline. */
export function stageAfter(current: Stage, direction: "out" | "in"): Stage {
  const order: Stage[] = ["researched", "enriched", "contacted", "responded"];
  const target: Stage = direction === "in" ? "responded" : "contacted";
  const i = order.indexOf(current);
  return i !== -1 && i < order.indexOf(target) ? target : current;
}

export function useLogInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ row, org }: { row: NewInteraction; org: Organization }) => {
      const stage = stageAfter(org.stage, row.direction);
      const patch: OrgPatch = {
        next_step: row.next_step ?? null,
        next_step_due: row.next_step_due ?? null,
      };
      if (stage !== org.stage) patch.stage = stage;
      if (demo) {
        demoStore.interactions.push({
          id: crypto.randomUUID(),
          contact_id: null,
          subject: null,
          summary: null,
          next_step: null,
          next_step_due: null,
          people: [],
          external_ref: null,
          created_by: null,
          created_at: new Date().toISOString(),
          ...row,
        });
      } else {
        const { error } = await db.from("interactions").insert(row);
        if (error) throw error;
      }
      await patchOrg(org.id, patch);
    },
    onSuccess: (_d, { org }) => {
      qc.invalidateQueries({ queryKey: ["crm", "orgs"] });
      qc.invalidateQueries({ queryKey: ["crm", "detail", org.id] });
      qc.invalidateQueries({ queryKey: ["crm", "leaderboard"] });
    },
  });
}

/** True when the signed-in user is on the crm_team allowlist (RLS hides the row otherwise). */
/** True for emails on crm_team and for devices that joined with the team link. */
export async function checkMembership() {
  if (demo) return true;
  const { data, error } = await db.rpc("is_crm_member");
  if (error) throw error;
  return data === true;
}

/** Adds the signed-in (usually anonymous) user to the team when the join secret matches. */
export async function joinWithSecret(secret: string) {
  const { data, error } = await db.rpc("join_crm", { secret });
  if (error) throw error;
  return data === true;
}

/** First names of the team, from crm_team.name. Used for the @people chips on a visit. */
export function useTeam(enabled: boolean) {
  return useQuery({
    queryKey: ["crm", "team"],
    enabled,
    staleTime: Infinity,
    queryFn: async (): Promise<string[]> => {
      if (demo) return ["Alex", "Sam", "Robin"];
      const { data, error } = await db.from("crm_team").select("name").order("name");
      if (error) throw error;
      return (data ?? []).map((r) => r.name).filter((n): n is string => !!n);
    },
  });
}

/** Visits per person, most first (Spotmapper's leaderboard). */
export function useLeaderboard(enabled: boolean) {
  return useQuery({
    queryKey: ["crm", "leaderboard"],
    enabled,
    queryFn: async (): Promise<[string, number][]> => {
      let rows: { people: string[] }[];
      if (demo) rows = demoStore.interactions.filter((i) => i.channel === "visit");
      else {
        const { data, error } = await db
          .from("interactions")
          .select("people")
          .eq("channel", "visit");
        if (error) throw error;
        rows = data ?? [];
      }
      const counts: Record<string, number> = {};
      for (const r of rows) for (const p of new Set(r.people)) counts[p] = (counts[p] ?? 0) + 1;
      return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    },
  });
}

export type NewOrg = Pick<Organization, "name" | "lat" | "lon"> & OrgPatch;

export function useCreateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: NewOrg): Promise<Organization> => {
      if (demo) {
        const now = new Date().toISOString();
        const o = {
          ...DEMO_BASE,
          stage: "researched",
          type: "restaurant",
          category: null,
          city: null,
          ...row,
          id: crypto.randomUUID(),
          created_at: now,
          updated_at: now,
        } as Organization;
        demoStore.orgs.push(o);
        return o;
      }
      const { data, error } = await db
        .from("organizations")
        .insert({ source: "app", ...row })
        .select()
        .single();
      if (error) throw error;
      return data as Organization;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "orgs"] }),
  });
}
