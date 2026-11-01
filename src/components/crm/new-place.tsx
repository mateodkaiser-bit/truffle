import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateOrg, useLogInteraction, useTeam } from "@/lib/crm/api";
import { todayIso } from "@/lib/crm/filters";
import { lastPeople, rememberPeople } from "@/lib/crm/people";
import {
  distM,
  nearbyPlaces,
  reverseAddress,
  searchPlacesByName,
  type NearbyPlace,
} from "@/lib/crm/places";
import { STAGE_META, TYPE_LABEL } from "@/lib/crm/stages";
import { ORG_TYPES, type OrgType, type Organization, type Stage } from "@/lib/crm/types";

export function PeopleChips({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const team = useTeam(true).data ?? [];
  if (!team.length) return null;
  return (
    <div>
      <div className={label}>Who was there</div>
      <div className="grid grid-cols-3 gap-2">
        {team.map((n) => {
          const on = value.includes(n);
          return (
            <button
              type="button"
              key={n}
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== n) : [...value, n])}
              className={`flex h-11 items-center justify-center gap-1 rounded-xl border text-base font-medium ${on ? "border-plum bg-plum text-paper" : "bg-background"}`}
            >
              {on && <Check className="size-4" />}
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const label = "mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground";

const OUTCOMES: { stage: Stage | null; label: string; visit: boolean }[] = [
  { stage: "responded", label: "Good convo", visit: true },
  { stage: "declined", label: "Don't go back", visit: true },
  { stage: null, label: "Just save it", visit: false },
];

type Props = {
  at: { lat: number; lon: number };
  orgs: Organization[];
  onOpenExisting: (id: string) => void;
  onDone: (id: string | null) => void;
};

/** Spotmapper's "tap the map to log": pick the place, tick who was there, one line of notes. */
export function NewPlace({ at, orgs, onOpenExisting, onDone }: Props) {
  const create = useCreateOrg();
  const log = useLogInteraction();
  const [nearby, setNearby] = useState<NearbyPlace[] | null>(null);
  const [name, setName] = useState("");
  const [pos, setPos] = useState(at);
  const [address, setAddress] = useState({ address: "", postcode: "", city: "" });
  const [type, setType] = useState<OrgType>("restaurant");
  const [category, setCategory] = useState("");
  const [people, setPeople] = useState<string[]>(lastPeople);
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState(0);
  const [picked, setPicked] = useState("");
  const [found, setFound] = useState<NearbyPlace[] | null>(null);

  // Places already in the CRM around the tap: the usual case is "we just walked out of one".
  const nearbyCrm = orgs
    .filter((o) => o.lat != null && o.lon != null)
    .map((o) => ({ o, d: distM(at.lat, at.lon, o.lat!, o.lon!) }))
    .filter((x) => x.d < 150)
    .sort((a, b) => a.d - b.d)
    .slice(0, 8);
  const inCrm = (n: string) => nearbyCrm.some((x) => x.o.name.toLowerCase() === n.toLowerCase());

  // Typing a name searches the CRM and OpenStreetMap within 1.5 km.
  const typed = name.trim();
  const searching = typed.length >= 3 && typed !== picked;
  const crmHits = searching
    ? orgs
        .filter((o) => o.name.toLowerCase().includes(typed.toLowerCase()))
        .map((o) => ({
          o,
          d: o.lat != null && o.lon != null ? distM(at.lat, at.lon, o.lat, o.lon) : 1e9,
        }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 4)
    : [];
  useEffect(() => {
    if (!searching) return setFound(null);
    const ac = new AbortController();
    const t = setTimeout(() => {
      searchPlacesByName(typed, at.lat, at.lon, ac.signal)
        .then((p) => setFound(p.slice(0, 6)))
        .catch(() => !ac.signal.aborted && setFound([]));
    }, 400);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [typed, searching, at.lat, at.lon]);

  useEffect(() => {
    const ac = new AbortController();
    setNearby(null);
    nearbyPlaces(at.lat, at.lon, ac.signal)
      .then((p) => {
        setNearby(p);
        const close = p[0];
        if (close && close.dist < 25) pick(close);
      })
      .catch(() => !ac.signal.aborted && setNearby([]));
    reverseAddress(at.lat, at.lon, ac.signal)
      .then((a) => a && setAddress((cur) => (cur.address ? cur : a)))
      .catch(() => {});
    return () => ac.abort();
  }, [at.lat, at.lon]);

  function pick(p: NearbyPlace) {
    setName(p.name);
    setPicked(p.name);
    setCategory(p.kind);
    setPos({ lat: p.lat, lon: p.lon });
    if (p.address) setAddress((a) => ({ ...a, address: p.address }));
  }

  // A place already in the CRM within 60 m with the same name: open that card instead of a duplicate.
  const existing = name.trim()
    ? orgs.find(
        (o) =>
          o.name.toLowerCase() === name.trim().toLowerCase() &&
          o.lat != null &&
          o.lon != null &&
          distM(o.lat, o.lon, pos.lat, pos.lon) < 60,
      )
    : undefined;

  const save = async () => {
    const o = OUTCOMES[outcome];
    if (!o) return;
    try {
      const org = await create.mutateAsync({
        name: name.trim(),
        lat: pos.lat,
        lon: pos.lon,
        type,
        category: category || null,
        address: address.address || null,
        postcode: address.postcode || null,
        city: address.city || null,
        stage: o.stage ?? "researched",
        declined_reason: o.stage === "declined" ? "Don't go back (visit)" : null,
      });
      if (o.visit) {
        await log.mutateAsync({
          org,
          row: {
            org_id: org.id,
            channel: "visit",
            direction: "out",
            date: todayIso(),
            summary: notes || null,
            people,
          },
        });
        rememberPeople(people);
      }
      navigator.vibrate?.(15);
      toast.success(`${org.name} saved`);
      onDone(org.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  };

  return (
    <div className="space-y-3 pb-6">
      {nearbyCrm.length > 0 && (
        <div>
          <div className={label}>Already in the CRM here</div>
          <div className="space-y-1">
            {nearbyCrm.map(({ o, d }) => (
              <button
                key={o.id}
                type="button"
                onClick={() => onOpenExisting(o.id)}
                className="flex w-full items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-left"
              >
                <span
                  className="inline-block size-3 shrink-0 rounded-full"
                  style={{ background: STAGE_META[o.stage].color }}
                />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{o.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {STAGE_META[o.stage].label} · {Math.round(d)} m
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className={label}>Other places nearby</div>
        {nearby === null && <p className="text-sm text-muted-foreground">Looking around…</p>}
        {nearby?.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing found. Type a name below.</p>
        )}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {nearby
            ?.filter((p) => !inCrm(p.name))
            .slice(0, 10)
            .map((p) => (
              <button
                key={p.name + p.lat}
                type="button"
                onClick={() => pick(p)}
                className={`w-40 shrink-0 rounded-lg border px-3 py-2 text-left ${name === p.name ? "border-ink bg-ink text-paper" : "bg-card"}`}
              >
                <span className="block truncate text-sm font-semibold">{p.name}</span>
                <span className="block truncate text-xs opacity-70">
                  {p.kind} · {Math.round(p.dist)} m
                </span>
              </button>
            ))}
        </div>
      </div>

      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Search or type the place name"
        className="h-11 text-base font-medium"
      />
      {searching && found === null && crmHits.length === 0 && (
        <p className="-mt-1 text-xs text-muted-foreground">Searching nearby…</p>
      )}
      {searching && (crmHits.length > 0 || (found?.length ?? 0) > 0) && (
        <div className="-mt-1 divide-y rounded-lg border bg-card">
          {crmHits.map(({ o, d }) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onOpenExisting(o.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
            >
              <span
                className="inline-block size-2.5 shrink-0 rounded-full"
                style={{ background: STAGE_META[o.stage].color }}
              />
              <span className="min-w-0 flex-1 truncate font-medium">{o.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                in CRM
                {d < 1e8
                  ? ` · ${d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`}`
                  : ""}
              </span>
            </button>
          ))}
          {found
            ?.filter((p) => !crmHits.some(({ o }) => o.name.toLowerCase() === p.name.toLowerCase()))
            .map((p) => (
              <button
                key={p.name + p.lat}
                type="button"
                onClick={() => pick(p)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
              >
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {p.kind} ·{" "}
                  {p.dist < 1000 ? `${Math.round(p.dist)} m` : `${(p.dist / 1000).toFixed(1)} km`}
                </span>
              </button>
            ))}
        </div>
      )}
      {existing && (
        <button
          type="button"
          onClick={() => onOpenExisting(existing.id)}
          className="w-full rounded-md bg-butter px-3 py-2 text-left text-sm"
        >
          Already in the CRM. Open {existing.name}
        </button>
      )}
      <div className="text-xs text-muted-foreground">
        {[address.address, address.postcode, address.city].filter(Boolean).join(", ") ||
          "No address found"}
      </div>
      <select
        aria-label="Type"
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        value={type}
        onChange={(e) => setType(e.target.value as OrgType)}
      >
        {ORG_TYPES.map((t) => (
          <option key={t} value={t}>
            {TYPE_LABEL[t]}
          </option>
        ))}
      </select>
      <PeopleChips value={people} onChange={setPeople} />
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Who you spoke to, what they said…"
      />
      <div className="grid grid-cols-3 gap-2">
        {OUTCOMES.map((o, i) => (
          <Button
            key={o.label}
            type="button"
            variant={outcome === i ? "default" : "outline"}
            onClick={() => setOutcome(i)}
            className="h-auto py-2 text-xs"
          >
            {o.label}
          </Button>
        ))}
      </div>
      <Button
        className="w-full"
        disabled={!name.trim() || !!existing || create.isPending || log.isPending}
        onClick={save}
      >
        {create.isPending || log.isPending ? "Saving…" : "Drop pin"}
      </Button>
    </div>
  );
}
