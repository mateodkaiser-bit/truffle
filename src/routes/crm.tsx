import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { List, LogOut, Map as MapIcon, SlidersHorizontal, Trophy, X } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  checkMembership,
  joinWithSecret,
  isDemoMode,
  setDemoMode,
  useLeaderboard,
  useOrgs,
} from "@/lib/crm/api";
import {
  applyFilters,
  countByStage,
  DEFAULT_FILTERS,
  LEAD_STATUS_LABEL,
  LEAD_STATUSES,
  leadStatus,
  type CrmFilters,
  type LeadStatus,
} from "@/lib/crm/filters";
import { STAGE_META, TYPE_LABEL } from "@/lib/crm/stages";
import { ORG_TYPES, STAGES, type OrgType, type Organization } from "@/lib/crm/types";
import { CrmLogin } from "@/components/crm/crm-login";
import { OrgCard } from "@/components/crm/org-card";
import { OrgList } from "@/components/crm/org-list";
import { NewPlace } from "@/components/crm/new-place";

const CrmMap = lazy(() => import("@/components/crm/crm-map").then((m) => ({ default: m.CrmMap })));

export const Route = createFileRoute("/crm")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Truffle CRM" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: CrmPage,
});

const glass = "border bg-card/95 shadow-soft backdrop-blur";

function CrmPage() {
  const [demo] = useState(
    () => import.meta.env.DEV && new URLSearchParams(window.location.search).has("demo"),
  );
  setDemoMode(demo);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [member, setMember] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (demo) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [demo]);

  // Team link: /crm#join=<secret>. The secret is read once and taken out of the address bar.
  const [joinSecret] = useState(() => {
    const m = window.location.hash.match(/join=([\w-]+)/);
    if (m) window.history.replaceState(null, "", window.location.pathname + window.location.search);
    return m?.[1] ?? null;
  });
  const [joinError, setJoinError] = useState("");
  const [joined, setJoined] = useState(!joinSecret);
  useEffect(() => {
    if (demo || !joinSecret || joined || session === undefined) return;
    if (!session) {
      supabase.auth.signInAnonymously().then(({ error }) => {
        if (error) setJoinError(`Could not open the team link: ${error.message}`);
      });
      return;
    }
    joinWithSecret(joinSecret).then(
      (ok) => {
        if (!ok) setJoinError("This team link is no longer valid. Ask for the new one.");
        setJoined(true);
      },
      (e: Error) => setJoinError(`Could not open the team link: ${e.message}`),
    );
  }, [demo, joinSecret, joined, session]);

  const userId = session?.user.id;
  const email = session?.user.email;
  useEffect(() => {
    if (demo) return setMember(true);
    if (!userId || !joined) return setMember(undefined);
    checkMembership().then(setMember, () => setMember(false));
  }, [userId, joined, demo]);

  if (!demo) {
    if (joinError)
      return (
        <Centered>
          <p>{joinError}</p>
        </Centered>
      );
    if (session === undefined || (joinSecret && !joined)) return <Centered>Loading…</Centered>;
    if (!session) return <CrmLogin />;
    if (member === undefined) return <Centered>Checking access…</Centered>;
    if (!member)
      return (
        <Centered>
          <p>
            {email
              ? `${email} is not on the team list.`
              : "This device has no access yet. Open the team link again."}
          </p>
          <button className="mt-3 underline" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </Centered>
      );
  }
  return <Crm />;
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground">
      {children}
    </main>
  );
}

function Crm() {
  const orgsQ = useOrgs(true);
  const orgs = useMemo(() => orgsQ.data ?? [], [orgsQ.data]);
  const [filters, setFilters] = useState<CrmFilters>(DEFAULT_FILTERS);
  const [view, setView] = useState<"map" | "list">("map");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ lat: number; lon: number } | null>(null);
  const [panel, setPanel] = useState<"filters" | "board" | null>(null);

  const filtered = useMemo(() => applyFilters(orgs, filters), [orgs, filters]);
  const counts = useMemo(() => countByStage(orgs, filters), [orgs, filters]);
  const selected = orgs.find((o) => o.id === selectedId) ?? null;
  const cities = useMemo(() => uniqueSorted(orgs.map((o) => o.city)), [orgs]);
  const tags = useMemo(() => uniqueSorted(orgs.flatMap((o) => o.tags)), [orgs]);
  const set = (patch: Partial<CrmFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const activeFilters =
    filters.types.length +
    (filters.city ? 1 : 0) +
    (filters.tag ? 1 : 0) +
    (filters.dueOnly ? 1 : 0) +
    (filters.hiddenLeadStatus.join() === DEFAULT_FILTERS.hiddenLeadStatus.join() ? 0 : 1);
  const leadCounts = useMemo(() => {
    const c: Partial<Record<LeadStatus, number>> = {};
    for (const o of orgs) {
      const s = leadStatus(o);
      if (s) c[s] = (c[s] ?? 0) + 1;
    }
    return c;
  }, [orgs]);

  const select = (id: string) => {
    setDraft(null);
    setSelectedId(id);
  };

  return (
    <main className="fixed inset-0 overflow-hidden bg-background">
      <Toaster position="top-center" />
      <Suspense fallback={null}>
        <CrmMap
          orgs={filtered}
          selectedId={selectedId}
          onSelect={select}
          draft={draft}
          onTapEmpty={(lat, lon, close) => {
            setSelectedId(null);
            setPanel(null);
            setDraft(close ? { lat, lon } : null);
          }}
        />
      </Suspense>

      {view === "list" && (
        <div className="absolute inset-0 z-10 overflow-y-auto bg-background pb-48 pt-[calc(env(safe-area-inset-top)+4.5rem)] md:pr-[26rem]">
          <OrgList orgs={filtered} onSelect={select} />
        </div>
      )}

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex flex-col gap-2 px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="flex items-center gap-2">
          <SearchBox orgs={orgs} value={filters.q} onChange={(q) => set({ q })} onPick={select} />
          <IconButton
            label="Filters"
            active={panel === "filters" || activeFilters > 0}
            onClick={() => setPanel((p) => (p === "filters" ? null : "filters"))}
          >
            <SlidersHorizontal />
            {activeFilters > 0 && <span className="text-xs">{activeFilters}</span>}
          </IconButton>
          <IconButton
            label={view === "map" ? "List view" : "Map view"}
            onClick={() => setView((v) => (v === "map" ? "list" : "map"))}
          >
            {view === "map" ? <List /> : <MapIcon />}
          </IconButton>
          <IconButton
            label="Leaderboard"
            active={panel === "board"}
            onClick={() => setPanel((p) => (p === "board" ? null : "board"))}
          >
            <Trophy />
          </IconButton>
        </div>
        {orgsQ.error && (
          <div className={`${glass} pointer-events-auto rounded-xl px-3 py-2 text-sm text-ember`}>
            Could not load the CRM: {orgsQ.error.message}
          </div>
        )}
        {panel === "filters" && (
          <FilterPanel
            filters={filters}
            set={set}
            cities={cities}
            tags={tags}
            leadCounts={leadCounts}
            onReset={() => setFilters(DEFAULT_FILTERS)}
          />
        )}
        {panel === "board" && <Leaderboard />}
      </div>

      {/* Legend: tap a stage to hide or show it */}
      {!selected && !draft && (
        <div className="absolute bottom-0 left-0 z-20 max-w-[calc(100%-4rem)] p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <div className={`${glass} flex flex-wrap gap-1 rounded-2xl p-2 text-xs`}>
            {STAGES.map((s) => {
              const on = filters.stages.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    set({
                      stages: on ? filters.stages.filter((x) => x !== s) : [...filters.stages, s],
                    })
                  }
                  className={`flex items-center gap-1.5 rounded-full px-2 py-1 ${on ? "" : "opacity-40"}`}
                >
                  <span
                    className="inline-block size-2.5 rounded-full"
                    style={{ background: STAGE_META[s].color }}
                  />
                  {STAGE_META[s].label}
                  <span className="text-muted-foreground">{counts[s]}</span>
                </button>
              );
            })}
            {isDemoMode() && <span className="px-2 py-1 font-semibold text-ember">Demo data</span>}
          </div>
        </div>
      )}

      {(selected || draft) && (
        <SidePanel onClose={() => (setSelectedId(null), setDraft(null))}>
          {selected && <OrgCard key={selected.id} org={selected} />}
          {draft && !selected && (
            <NewPlace
              key={`${draft.lat},${draft.lon}`}
              at={draft}
              orgs={orgs}
              onOpenExisting={select}
              onDone={(id) => (id ? select(id) : setDraft(null))}
            />
          )}
        </SidePanel>
      )}
    </main>
  );
}

function uniqueSorted(values: (string | null)[]) {
  return [...new Set(values.filter((v): v is string => !!v))].sort((a, b) =>
    a.localeCompare(b, "nl"),
  );
}

function IconButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`${glass} pointer-events-auto flex h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-xl px-2.5 [&_svg]:size-[18px] ${active ? "bg-ink text-paper" : ""}`}
    >
      {children}
    </button>
  );
}

function SearchBox({
  orgs,
  value,
  onChange,
  onPick,
}: {
  orgs: Organization[];
  value: string;
  onChange: (q: string) => void;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hits = useMemo(() => {
    const q = value.trim().toLowerCase();
    return q.length < 2 ? [] : orgs.filter((o) => o.name.toLowerCase().includes(q)).slice(0, 6);
  }, [orgs, value]);
  return (
    <div className="pointer-events-auto relative min-w-0 flex-1">
      <Input
        aria-label="Search"
        placeholder="Search name, city, owner…"
        value={value}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => onChange(e.target.value)}
        className={`${glass} h-11 rounded-xl pr-9 text-base md:text-sm`}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
        >
          <X className="size-4" />
        </button>
      )}
      {open && hits.length > 0 && (
        <div className={`${glass} absolute inset-x-0 top-12 rounded-xl p-1`}>
          {hits.map((o) => (
            <button
              key={o.id}
              type="button"
              onMouseDown={() => onPick(o.id)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <span
                className="inline-block size-2.5 shrink-0 rounded-full"
                style={{ background: STAGE_META[o.stage].color }}
              />
              <span className="truncate font-medium">{o.name}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">{o.city}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterPanel({
  filters,
  set,
  cities,
  tags,
  leadCounts,
  onReset,
}: {
  filters: CrmFilters;
  set: (p: Partial<CrmFilters>) => void;
  cities: string[];
  tags: string[];
  leadCounts: Partial<Record<LeadStatus, number>>;
  onReset: () => void;
}) {
  const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
  const toggleType = (t: OrgType) =>
    set({
      types: filters.types.includes(t)
        ? filters.types.filter((x) => x !== t)
        : [...filters.types, t],
    });
  return (
    <div
      className={`${glass} pointer-events-auto max-h-[60dvh] w-full max-w-md space-y-3 self-end overflow-y-auto rounded-2xl p-4`}
    >
      <div>
        <div className="mb-1.5 text-xs font-semibold">Type</div>
        <div className="flex flex-wrap gap-1.5">
          {ORG_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleType(t)}
              className={`rounded-full border px-3 py-1 text-xs ${filters.types.includes(t) ? "border-ink bg-ink text-paper" : "bg-background"}`}
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
      {LEAD_STATUSES.some((s) => leadCounts[s]) && (
        <div>
          <div className="mb-1.5 text-xs font-semibold">Lead status (new permits)</div>
          <div className="flex flex-wrap gap-1.5">
            {LEAD_STATUSES.filter((s) => leadCounts[s]).map((s) => {
              const on = !filters.hiddenLeadStatus.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    set({
                      hiddenLeadStatus: on
                        ? [...filters.hiddenLeadStatus, s]
                        : filters.hiddenLeadStatus.filter((x) => x !== s),
                    })
                  }
                  className={`rounded-full border px-3 py-1 text-xs ${on ? "border-ink bg-ink text-paper" : "bg-background"}`}
                >
                  {LEAD_STATUS_LABEL[s]} {leadCounts[s]}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-semibold">
          City
          <select
            className={sel}
            value={filters.city}
            onChange={(e) => set({ city: e.target.value })}
          >
            <option value="">All</option>
            {cities.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold">
          Tag
          <select
            className={sel}
            value={filters.tag}
            onChange={(e) => set({ tag: e.target.value })}
          >
            <option value="">All</option>
            {tags.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={filters.dueOnly}
          onChange={(e) => set({ dueOnly: e.target.checked })}
          className="size-4"
        />
        Only next steps due today or earlier
      </label>
      <div className="flex items-center justify-between border-t pt-3 text-sm">
        <button type="button" className="underline" onClick={onReset}>
          Reset filters
        </button>
        {!isDemoMode() && (
          <button
            type="button"
            className="flex items-center gap-1 text-muted-foreground"
            onClick={() => supabase.auth.signOut()}
          >
            <LogOut className="size-4" /> Sign out
          </button>
        )}
      </div>
    </div>
  );
}

function Leaderboard() {
  const board = useLeaderboard(true).data ?? [];
  return (
    <div className={`${glass} pointer-events-auto w-60 self-end rounded-2xl p-4`}>
      <div className="mb-3 font-display text-base">Visits</div>
      {board.length === 0 && <p className="text-sm text-muted-foreground">No visits logged yet.</p>}
      <ol className="space-y-2">
        {board.map(([n, c], i) => (
          <li key={n} className="flex items-center gap-3 text-sm">
            <span className="w-4 text-muted-foreground">{i + 1}</span>
            <span className="flex-1 font-medium">@{n}</span>
            <span className="font-display">{c}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Bottom sheet on a phone, side panel on a wider screen. The map stays usable behind it. */
function SidePanel({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 max-h-[78dvh] overflow-y-auto overscroll-contain rounded-t-3xl border bg-background px-4 pt-4 shadow-card md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[26rem] md:rounded-none md:pt-[calc(env(safe-area-inset-top)+4.5rem)]">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-muted text-muted-foreground md:top-[calc(env(safe-area-inset-top)+4.5rem)]"
      >
        <X className="size-4" />
      </button>
      <div className="pb-[env(safe-area-inset-bottom)]">{children}</div>
    </div>
  );
}
