import { useState, type ReactNode } from "react";
import { Globe, Instagram, Mail, MapPin, Navigation, Phone, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { lastPeople, rememberPeople } from "@/lib/crm/people";
import { PeopleChips } from "./new-place";
import { ScoreDonut } from "./score-donut";
import type { OrgScore } from "@/lib/crm/score";
import { useLogInteraction, useOrgDetail, useUpdateOrg, type OrgPatch } from "@/lib/crm/api";
import { todayIso } from "@/lib/crm/filters";
import { CHANNEL_LABEL, STAGE_META, TYPE_LABEL } from "@/lib/crm/stages";
import {
  CHANNELS,
  STAGES,
  type Channel,
  type Direction,
  type Organization,
  type Stage,
} from "@/lib/crm/types";

const select = "h-9 rounded-md border border-input bg-background px-2 text-sm";
const sectionLabel = "text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground";

function igUrl(handle: string) {
  return handle.startsWith("http")
    ? handle
    : `https://www.instagram.com/${handle.replace(/^@/, "")}/`;
}

function webUrl(site: string) {
  return site.startsWith("http") ? site : `https://${site}`;
}

function routeUrl(o: Organization) {
  const dest =
    o.lat != null && o.lon != null
      ? `${o.lat},${o.lon}`
      : [o.address, o.postcode, o.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className={sectionLabel}>{label}</div>
      <div className="mt-0.5 whitespace-pre-line text-sm">{children}</div>
    </div>
  );
}

export function StageDot({ stage }: { stage: Stage }) {
  return (
    <span
      className="inline-block size-2.5 shrink-0 rounded-full"
      style={{ background: STAGE_META[stage].color }}
    />
  );
}

export function OrgCard({ org, score }: { org: Organization; score?: OrgScore | undefined }) {
  const detail = useOrgDetail(org.id);
  const update = useUpdateOrg();
  const [logOpen, setLogOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const contacts = detail.data?.contacts ?? [];
  const interactions = detail.data?.interactions ?? [];
  const last = interactions[0];
  const email = org.email ?? contacts.find((c) => c.email)?.email ?? null;
  const phone = org.phone ?? contacts.find((c) => c.phone)?.phone ?? null;
  const overdue = org.next_step_due && org.next_step_due <= todayIso();

  const save = (patch: OrgPatch, msg = "Saved") =>
    update.mutate(
      { id: org.id, patch },
      { onSuccess: () => toast.success(msg), onError: (e) => toast.error(e.message) },
    );

  return (
    <div className="space-y-5 pb-8">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{TYPE_LABEL[org.type]}</span>
          {org.category && <span>· {org.category}</span>}
          {org.city && <span>· {org.city}</span>}
        </div>
        <h2 className="mt-1 text-2xl leading-tight">{org.name}</h2>
        {org.address && (
          <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5" /> {[org.address, org.postcode].filter(Boolean).join(", ")}
          </div>
        )}
        {org.do_not_contact && (
          <div className="mt-2 flex items-center gap-2 rounded-md bg-ember/10 px-2 py-1.5 text-sm text-ember">
            <ShieldAlert className="size-4" /> Never contact by automation
          </div>
        )}
      </div>

      {score && <ScoreDonut score={score} />}

      <div className="flex items-center gap-2">
        <StageDot stage={org.stage} />
        <select
          aria-label="Stage"
          className={select}
          value={org.stage}
          onChange={(e) =>
            save(
              { stage: e.target.value as Stage },
              `Stage: ${STAGE_META[e.target.value as Stage].label}`,
            )
          }
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_META[s].label}
            </option>
          ))}
        </select>
        {org.stage === "declined" && (
          <Input
            key={org.declined_reason ?? ""}
            className="h-9"
            placeholder="Why declined"
            defaultValue={org.declined_reason ?? ""}
            onBlur={(e) =>
              e.target.value !== (org.declined_reason ?? "") &&
              save({ declined_reason: e.target.value || null })
            }
          />
        )}
      </div>

      <div className="grid grid-cols-5 gap-2">
        <ContactButton
          href={phone ? `tel:${phone.replace(/\s/g, "")}` : null}
          icon={<Phone />}
          label="Call"
        />
        <ContactButton href={email ? `mailto:${email}` : null} icon={<Mail />} label="Email" />
        <ContactButton
          href={org.website ? webUrl(org.website) : null}
          icon={<Globe />}
          label="Site"
          external
        />
        <ContactButton
          href={org.instagram ? igUrl(org.instagram) : null}
          icon={<Instagram />}
          label="Insta"
          external
        />
        <ContactButton
          href={org.lat != null || org.address ? routeUrl(org) : null}
          icon={<Navigation />}
          label="Route"
          external
        />
      </div>

      <div
        className={`rounded-xl border p-3 ${overdue ? "border-ember/60 bg-ember/5" : "bg-card"}`}
      >
        <div className={sectionLabel}>Next step</div>
        <NextStep key={`${org.next_step}|${org.next_step_due}`} org={org} onSave={(p) => save(p)} />
        {last && (
          <div className="mt-3 border-t pt-2 text-sm">
            <span className="text-muted-foreground">
              Last: {CHANNEL_LABEL[last.channel]} {last.direction === "in" ? "from them" : "by us"},{" "}
              {last.date}
            </span>
            {(last.summary || last.subject) && (
              <div className="mt-0.5">{last.summary || last.subject}</div>
            )}
          </div>
        )}
        <Button
          className="mt-3 w-full"
          variant={logOpen ? "outline" : "default"}
          onClick={() => setLogOpen((v) => !v)}
        >
          {logOpen ? "Cancel" : "Log a visit, call or email"}
        </Button>
        {logOpen && <LogForm org={org} onDone={() => setLogOpen(false)} />}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-sans text-sm font-semibold">Before you walk in</h3>
          <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
            {editing ? "Done" : "Edit"}
          </Button>
        </div>
        {editing ? (
          <EditNotes org={org} onSave={(p) => save(p)} />
        ) : (
          <>
            {org.hook && <Field label="Why they fit">{org.hook}</Field>}
            {org.promised && <Field label="What we promised">{org.promised}</Field>}
            {org.they_asked && <Field label="What they asked">{org.they_asked}</Field>}
            {org.pitch_angle && (
              <Field label="Opener">
                {org.pitch_angle.split("\n").map((line, i) => (
                  <p key={i} className={i ? "mt-1.5" : ""}>
                    {line}
                  </p>
                ))}
              </Field>
            )}
            {org.opening_hours && <Field label="Opening hours">{org.opening_hours}</Field>}
            {!org.hook && !org.promised && !org.they_asked && !org.pitch_angle && (
              <p className="text-sm text-muted-foreground">Nothing noted yet.</p>
            )}
          </>
        )}
      </section>

      {contacts.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-sans text-sm font-semibold">People</h3>
          {contacts.map((c) => (
            <div key={c.id} className="text-sm">
              <div className="font-medium">
                {c.name || c.email}{" "}
                {c.role && <span className="font-normal text-muted-foreground">· {c.role}</span>}
              </div>
              <div className="flex flex-wrap gap-x-3 text-muted-foreground">
                {c.email && (
                  <a className="underline" href={`mailto:${c.email}`}>
                    {c.email}
                  </a>
                )}
                {c.phone && (
                  <a className="underline" href={`tel:${c.phone.replace(/\s/g, "")}`}>
                    {c.phone}
                  </a>
                )}
                {c.linkedin && (
                  <a className="underline" href={c.linkedin} target="_blank" rel="noreferrer">
                    LinkedIn
                  </a>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {(org.owner_name ||
        org.pos_hint ||
        org.opened_year ||
        org.size_note ||
        org.notes ||
        org.tags.length > 0) && (
        <section className="space-y-3">
          <h3 className="font-sans text-sm font-semibold">Details</h3>
          {org.owner_name && <Field label="Owner">{org.owner_name}</Field>}
          {org.opened_year && <Field label="Opened">{org.opened_year}</Field>}
          {org.pos_hint && <Field label="POS / reservations">{org.pos_hint}</Field>}
          {org.size_note && <Field label="Size">{org.size_note}</Field>}
          {org.notes && <Field label="Notes">{org.notes}</Field>}
          {org.tags.length > 0 && <Field label="Tags">{org.tags.join(", ")}</Field>}
        </section>
      )}

      {interactions.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-sans text-sm font-semibold">History</h3>
          <ol className="space-y-2 border-l pl-3">
            {interactions.map((i) => (
              <li key={i.id} className="text-sm">
                <div className="text-xs text-muted-foreground">
                  {i.date} · {CHANNEL_LABEL[i.channel]} {i.direction === "in" ? "in" : "out"}
                  {i.people.length > 0 && ` · ${i.people.map((n) => `@${n}`).join(" ")}`}
                </div>
                <div>{i.summary || i.subject}</div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function ContactButton({
  href,
  icon,
  label,
  external,
}: {
  href: string | null;
  icon: ReactNode;
  label: string;
  external?: boolean;
}) {
  const cls = "flex flex-col items-center gap-1 rounded-lg border py-2 text-xs [&_svg]:size-4";
  if (!href)
    return (
      <span className={`${cls} opacity-35`}>
        {icon}
        {label}
      </span>
    );
  return (
    <a
      className={`${cls} bg-card hover:bg-muted`}
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {icon}
      {label}
    </a>
  );
}

function NextStep({ org, onSave }: { org: Organization; onSave: (p: OrgPatch) => void }) {
  const [text, setText] = useState(org.next_step ?? "");
  const [due, setDue] = useState(org.next_step_due ?? "");
  const dirty = text !== (org.next_step ?? "") || due !== (org.next_step_due ?? "");
  return (
    <div className="mt-1 space-y-2">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. Send product list"
      />
      <div className="flex gap-2">
        <Input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="flex-1"
        />
        {dirty && (
          <Button
            size="sm"
            className="h-9"
            onClick={() => onSave({ next_step: text || null, next_step_due: due || null })}
          >
            Save
          </Button>
        )}
      </div>
    </div>
  );
}

function LogForm({ org, onDone }: { org: Organization; onDone: () => void }) {
  const log = useLogInteraction();
  const [channel, setChannel] = useState<Channel>("visit");
  const [direction, setDirection] = useState<Direction>("out");
  const [date, setDate] = useState(todayIso());
  const [summary, setSummary] = useState("");
  // Starts from the current next step, so a log keeps it unless it is changed or cleared here.
  const [next, setNext] = useState(org.next_step ?? "");
  const [due, setDue] = useState(org.next_step_due ?? "");
  const [people, setPeople] = useState<string[]>(lastPeople);

  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        log.mutate(
          {
            org,
            row: {
              org_id: org.id,
              channel,
              direction,
              date,
              people,
              summary: summary || null,
              next_step: next || null,
              next_step_due: due || null,
            },
          },
          {
            onSuccess: () => {
              rememberPeople(people);
              toast.success("Logged");
              onDone();
            },
            onError: (err) => toast.error(err.message),
          },
        );
      }}
    >
      <div className="flex flex-wrap gap-1.5">
        {CHANNELS.map((c) => (
          <button
            type="button"
            key={c}
            onClick={() => setChannel(c)}
            className={`rounded-full border px-3 py-1 text-sm ${channel === c ? "border-ink bg-ink text-paper" : "bg-background"}`}
          >
            {CHANNEL_LABEL[c]}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <select
          aria-label="Direction"
          className={`${select} flex-1`}
          value={direction}
          onChange={(e) => setDirection(e.target.value as Direction)}
        >
          <option value="out">We reached out</option>
          <option value="in">They reached us</option>
        </select>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1"
        />
      </div>
      <PeopleChips value={people} onChange={setPeople} />
      <Textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="What happened?"
        rows={3}
      />
      <Input
        value={next}
        onChange={(e) => setNext(e.target.value)}
        placeholder="Next step (clear it when done)"
      />
      <Input
        type="date"
        value={due}
        onChange={(e) => setDue(e.target.value)}
        aria-label="Next step due"
      />
      <Button type="submit" className="w-full" disabled={log.isPending}>
        Save log
      </Button>
    </form>
  );
}

function EditNotes({ org, onSave }: { org: Organization; onSave: (p: OrgPatch) => void }) {
  const fields = [
    ["hook", "Why they fit"],
    ["promised", "What we promised"],
    ["they_asked", "What they asked"],
    ["pitch_angle", "Opener"],
    ["opening_hours", "Opening hours"],
    ["phone", "Phone"],
    ["notes", "Notes"],
  ] as const;
  return (
    <div className="space-y-2">
      {fields.map(([key, label]) => (
        <label key={key} className="block">
          <span className={sectionLabel}>{label}</span>
          <Textarea
            rows={key === "phone" || key === "opening_hours" ? 1 : 2}
            defaultValue={org[key] ?? ""}
            onBlur={(e) =>
              e.target.value !== (org[key] ?? "") && onSave({ [key]: e.target.value || null })
            }
          />
        </label>
      ))}
    </div>
  );
}
