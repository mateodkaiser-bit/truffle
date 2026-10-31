import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateOrg, useLogInteraction, useTeam } from "@/lib/crm/api";
import { todayIso } from "@/lib/crm/filters";
import { lastPeople, rememberPeople } from "@/lib/crm/people";
import { distM, nearbyPlaces, reverseAddress, type NearbyPlace } from "@/lib/crm/places";
import { TYPE_LABEL } from "@/lib/crm/stages";
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
    <div className="flex flex-wrap gap-1.5">
      {team.map((n) => {
        const on = value.includes(n);
        return (
          <button
            type="button"
            key={n}
            onClick={() => onChange(on ? value.filter((x) => x !== n) : [...value, n])}
            className={`rounded-full border px-3 py-1 text-sm ${on ? "border-plum bg-plum text-paper" : "bg-background"}`}
          >
            @{n}
          </button>
        );
      })}
    </div>
  );
}

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
      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Nearby
        </div>
        {nearby === null && <p className="text-sm text-muted-foreground">Looking around…</p>}
        {nearby?.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing found. Type a name below.</p>
        )}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {nearby?.slice(0, 10).map((p) => (
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
        placeholder="Place name"
        className="h-11 text-base font-medium"
      />
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
