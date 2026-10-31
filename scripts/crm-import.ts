// Import CRM data from local lead files into Supabase. Run locally with Bun; see README "CRM import".
//
//   bun scripts/crm-import.ts --dry-run                  # build everything, print a summary, write nothing
//   TRUFFLE_CRM_EMAIL=... TRUFFLE_CRM_PASSWORD=... bun scripts/crm-import.ts
//
// The data files stay outside this public repo. Nothing from ~/truffle-pilots/raw or any invoice
// data is read. The script signs in as a team member, so row level security applies as in the app.
// Rows are keyed on external_ref: a re-run only adds new rows and leaves edits made in the app alone,
// unless --refresh is passed (then import-owned fields are overwritten).
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type {
  Channel,
  Contact,
  Interaction,
  OrgType,
  Organization,
  Stage,
} from "../src/lib/crm/types";

const HOME = homedir();
const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry-run");
const REFRESH = args.has("--refresh");
const env = (k: string, d = "") => process.env[k] ?? d;

const DATA = env("CRM_DATA_DIR", join(HOME, "truffle-pilots/work/external"));
const LEADS_DIR = env("CRM_LEADS_DIR", join(HOME, "truffle-leads/data"));
const SPOTMAPPER_CSV = env("CRM_SPOTMAPPER_CSV");
const OVERRIDES = env("CRM_OVERRIDES", join(DATA, "crm-overrides-2026-10-31.json"));
const GEOCODE_CACHE = env("CRM_GEOCODE_CACHE", join(DATA, ".crm-geocode-cache.json"));
const FILES = {
  suppliers: join(DATA, "supplier-leads-2026-10-28.csv"),
  accountants: join(DATA, "accountant-leads-2026-10-28.csv"),
  restaurants: join(DATA, "restaurant-leads-2026-10-31.csv"),
  outreach: join(DATA, "outreach-log-2026-10-28.csv"),
};

if (/truffle-pilots\/(raw|work\/[^/]+\.csv)/.test(Object.values(FILES).join(" "))) {
  throw new Error("Refusing to read pilot data: only work/external lead files are allowed.");
}

// ---------- helpers ----------

type Row = Record<string, string>;

/** RFC 4180 CSV with quoted fields and newlines; the delimiter is sniffed from the header. */
function readCsv(path: string): Row[] {
  const raw = readFileSync(path, "utf8");
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  const header = text.slice(0, text.indexOf("\n"));
  const delim = (header.match(/;/g)?.length ?? 0) > (header.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  const [head, ...body] = rows;
  if (!head) return [];
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]/g, "");
const slug = (s: string) => norm(s).slice(0, 60) || "x";
const cityOf = (s: string) =>
  s
    .replace(/\(.*?\)/g, "")
    .split(/[,/]| and /)[0]!
    .trim();
const nn = (s: string | undefined) => (s && s.trim() ? s.trim() : null);
const firstEmail = (s: string) =>
  s
    .split(/[;,\s]+/)
    .find((e) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e) && !/voorbeeld|example/i.test(e)) ?? null;

function distM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = Math.PI / 180;
  const x = (lon2 - lon1) * r * Math.cos(((lat1 + lat2) / 2) * r);
  return Math.sqrt(x * x + ((lat2 - lat1) * r) ** 2) * 6371000;
}

const ORDER: Stage[] = [
  "researched",
  "enriched",
  "contacted",
  "responded",
  "in_conversation",
  "pilot_partner",
];

type OrgRow = Omit<Organization, "id" | "created_at" | "updated_at"> & { external_ref: string };
type ContactRow = Omit<Contact, "id" | "org_id" | "created_at"> & {
  org_ref: string;
  external_ref: string;
};
type InteractionRow = Omit<
  Interaction,
  "id" | "org_id" | "contact_id" | "created_by" | "created_at"
> & {
  org_ref: string;
  external_ref: string;
};

const orgs = new Map<string, OrgRow>();
const contacts = new Map<string, ContactRow>();
const interactions = new Map<string, InteractionRow>();

function blank(ref: string, name: string, type: OrgType, source: string): OrgRow {
  return {
    external_ref: ref,
    name,
    type,
    stage: "researched",
    declined_reason: null,
    category: null,
    city: null,
    address: null,
    postcode: null,
    lat: null,
    lon: null,
    website: null,
    instagram: null,
    phone: null,
    email: null,
    opening_hours: null,
    size_note: null,
    tags: [],
    source,
    opened_year: null,
    pos_hint: null,
    owner_name: null,
    hook: null,
    notes: null,
    promised: null,
    they_asked: null,
    pitch_angle: null,
    next_step: null,
    next_step_due: null,
    do_not_contact: false,
  };
}

/** Fill empty fields only, so the first (richest) source wins. */
function fill(o: OrgRow, patch: Partial<OrgRow>) {
  for (const [k, v] of Object.entries(patch) as [keyof OrgRow, unknown][]) {
    if (v == null || v === "") continue;
    if (k === "tags") o.tags = [...new Set([...o.tags, ...(v as string[])])];
    else if (o[k] == null || o[k] === "") (o as Record<string, unknown>)[k] = v;
  }
}

function bump(o: OrgRow, s: Stage) {
  if (o.stage === "declined" || o.stage === "pilot_partner") return;
  if (s === "declined" || ORDER.indexOf(s) > ORDER.indexOf(o.stage)) o.stage = s;
}

function addNote(o: OrgRow, note: string) {
  o.notes = o.notes ? `${o.notes}\n${note}` : note;
}

function addContact(o: OrgRow, c: Partial<ContactRow>) {
  const key = `${o.external_ref}:${slug(c.email ?? c.name ?? "")}`;
  const cur = contacts.get(key);
  const row: ContactRow = {
    org_ref: o.external_ref,
    external_ref: key,
    name: nn(c.name ?? undefined),
    role: nn(c.role ?? undefined),
    email: nn(c.email ?? undefined),
    phone: nn(c.phone ?? undefined),
    linkedin: nn(c.linkedin ?? undefined),
    notes: nn(c.notes ?? undefined),
  };
  if (cur) for (const [k, v] of Object.entries(row)) (cur as Record<string, unknown>)[k] ??= v;
  else contacts.set(key, row);
}

function addInteraction(
  o: OrgRow,
  ref: string,
  i: Partial<InteractionRow> & { channel: Channel; date: string },
) {
  interactions.set(ref, {
    org_ref: o.external_ref,
    external_ref: ref,
    direction: "out",
    subject: null,
    summary: null,
    next_step: null,
    next_step_due: null,
    people: [],
    ...i,
  });
}

/** Name lookup: exact normalised name, then one name starting with the other (both 4+ chars). */
function findOrg(
  name: string,
  opts: { type?: OrgType; city?: string; near?: [number, number] } = {},
) {
  const key = norm(name);
  if (key.length < 3) return undefined;
  const all = [...orgs.values()].filter((o) => !opts.type || o.type === opts.type);
  const near = (o: OrgRow) =>
    !opts.near ||
    o.lat == null ||
    o.lon == null ||
    distM(o.lat, o.lon, opts.near[0], opts.near[1]) < 150;
  const sameCity = (o: OrgRow) =>
    !opts.city || !o.city || norm(cityOf(o.city)) === norm(cityOf(opts.city));
  const exact = all.filter((o) => norm(o.name) === key && near(o) && sameCity(o));
  if (exact.length) return exact[0];
  if (key.length < 4) return undefined;
  const loose = all.filter((o) => {
    const k = norm(o.name);
    return k.length >= 4 && (k.startsWith(key) || key.startsWith(k)) && near(o) && sameCity(o);
  });
  return loose.length === 1 ? loose[0] : undefined;
}

// ---------- sources ----------

function importSuppliers() {
  for (const r of readCsv(FILES.suppliers)) {
    const cat = r["category"] ?? "";
    const type: OrgType =
      /wholesale/i.test(cat) && !/^(fish|bakery|meat)/i.test(cat) ? "wholesaler" : "supplier";
    const o = blank(`supplier:${slug(r["name"]!)}`, r["name"]!, type, "supplier-leads-2026-10-28");
    fill(o, {
      category: nn(cat),
      city: nn(r["city"]),
      website: nn(r["website"]),
      email: firstEmail(r["contact_email"] ?? ""),
      size_note: nn(r["size_note"]),
      notes: [
        r["notes"],
        r["public_prices"] && `Public prices: ${r["public_prices"]}`,
        r["contact_form_url"] && `Form: ${r["contact_form_url"]}`,
      ]
        .filter(Boolean)
        .join("\n"),
      tags: ["supplier-lead"],
    });
    if (o.email) o.stage = "enriched";
    orgs.set(o.external_ref, o);
  }
}

function importAccountants() {
  for (const r of readCsv(FILES.accountants)) {
    const name = r["name"]!.replace(/\s*\(.*\)\s*$/, "");
    const o = blank(`accountant:${slug(name)}`, name, "accountant", "accountant-leads-2026-10-28");
    fill(o, {
      city: nn(r["city"]),
      website: nn(r["website"]),
      email: firstEmail(r["contact_email"] ?? ""),
      size_note: nn(r["size_note"]),
      hook: nn(r["notes"]),
      notes: [
        r["software"] && `Software: ${r["software"]}`,
        r["horeca_evidence_url"] && `Horeca evidence: ${r["horeca_evidence_url"]}`,
      ]
        .filter(Boolean)
        .join("\n"),
      tags: [r["priority"] ? `priority-${r["priority"]}` : "", "accountant-lead"].filter(Boolean),
    });
    if (r["contact_person"] || r["linkedin"])
      addContact(o, {
        name: r["contact_person"] ?? null,
        role: r["contact_role"] ?? null,
        linkedin: r["linkedin"] ?? null,
      });
    if (o.email || r["contact_person"]) o.stage = "enriched";
    orgs.set(o.external_ref, o);
  }
}

function importLeads() {
  const files = existsSync(LEADS_DIR)
    ? readdirSync(LEADS_DIR)
        .filter((f) => /^leads-\d{4}-\d{2}-\d{2}\.csv$/.test(f))
        .sort()
    : [];
  const latest = files.at(-1);
  if (!latest)
    return console.warn(`No leads-DATE.csv in ${LEADS_DIR}, skipping the lead pipeline.`);
  for (const r of readCsv(join(LEADS_DIR, latest))) {
    // Same lead_id as truffle-leads/score.py: osm:<osm_id>, else addr:<postcode>-<number>.
    const nr = (r["address"] ?? "").match(/(\d+\s*[a-zA-Z]?)\s*$/)?.[1]?.replace(/\s/g, "") ?? "";
    const leadId = r["osm_id"] ? `osm:${r["osm_id"]}` : `addr:${r["postcode"]}-${nr}`;
    const o = blank(
      `lead:${leadId}`,
      r["name"] || r["address"] || leadId,
      "restaurant",
      latest.replace(".csv", ""),
    );
    const signals = r["signals"] ?? "";
    fill(o, {
      category: nn(r["cuisine"]) ?? nn((r["type"] ?? "").replace(/_/g, " ")),
      city: nn(r["municipality"]),
      address: nn(r["address"]),
      postcode: nn(r["postcode"]),
      lat: r["lat"] ? Number(r["lat"]) : null,
      lon: r["lon"] ? Number(r["lon"]) : null,
      website: nn(r["website"]),
      email: firstEmail(r["email"] ?? ""),
      instagram: nn(r["instagram"]),
      phone: nn(r["phone"]),
      opened_year: Number(signals.match(/since (\d{4})/)?.[1]) || null,
      pos_hint:
        signals.match(/lightspeed|tebi|untill|mr\.? ?winston|qr ordering/gi)?.join(", ") ?? null,
      hook: nn(signals),
      notes: [
        `Lead score ${r["score"]}.`,
        r["permit_url"] && `Permit (${r["permit_stage"]}, ${r["permit_date"]}): ${r["permit_url"]}`,
      ]
        .filter(Boolean)
        .join("\n"),
      tags: ["new-permit", r["type"] ?? ""].filter(Boolean),
    });
    if (o.email || o.instagram || o.phone) o.stage = "enriched";
    orgs.set(o.external_ref, o);
  }
  console.log(`Leads: ${latest}`);
}

function importRestaurants() {
  for (const r of readCsv(FILES.restaurants)) {
    const addr = r["address"] ?? "";
    const postcode = addr.match(/\d{4}\s?[A-Z]{2}/)?.[0]?.replace(/\s/g, "") ?? null;
    const street = addr.split(",")[0]?.trim() || null;
    const existing = findOrg(r["name"]!, { type: "restaurant", city: r["city"] ?? "" });
    const o =
      existing ??
      blank(
        `restaurant:${slug(r["name"]!)}`,
        r["name"]!,
        "restaurant",
        "restaurant-leads-2026-10-31",
      );
    // This hand-researched file is richer than the permit pipeline: its hook and owner win.
    if (existing) {
      if (r["hook"]) existing.hook = r["hook"];
      addNote(existing, `Also in restaurant-leads-2026-10-31 (priority ${r["priority"]}).`);
    }
    fill(o, {
      city: nn(r["city"]),
      address: street,
      postcode,
      website: nn(r["website"]),
      email: firstEmail(r["contact_email"] ?? ""),
      instagram: nn(r["instagram"]),
      owner_name: nn(r["owner_name"]),
      pos_hint: nn(r["pos_hint"]),
      hook: nn(r["hook"]),
      category: nn(r["concept"]),
      opened_year: Number(r["opened"]) || null,
      size_note: r["sites"] ? `${r["sites"]} site(s)` : null,
      notes: nn(r["notes"]),
      tags: [r["priority"] ? `priority-${r["priority"]}` : "", "restaurant-lead"].filter(Boolean),
    });
    bump(o, o.email || o.instagram ? "enriched" : "researched");
    orgs.set(o.external_ref, o);
  }
}

function importOutreach(types: Record<string, OrgType>) {
  const seen = new Map<string, number>();
  for (const r of readCsv(FILES.outreach)) {
    const status = (r["status"] ?? "").toLowerCase();
    if (!/^(sent|submitted)$/.test(status)) continue;
    const raw = r["recipient_org"] ?? "";
    const prefix = raw.match(/^(accountant|restaurant):\s*/i)?.[1]?.toLowerCase();
    const person = raw.match(/\(([^)]*)\)/)?.[1];
    const name = raw
      .replace(/^(accountant|restaurant):\s*/i, "")
      .replace(/\s*\(.*\)\s*$/, "")
      .trim();
    const typeHint = Object.entries(types).find(([k]) => norm(name).includes(k))?.[1];
    const type = (prefix as OrgType | undefined) ?? undefined;
    let o = findOrg(name, type ? { type } : {});
    if (!o) {
      o = blank(
        `outreach:${slug(name)}`,
        name,
        typeHint ?? type ?? "other",
        "outreach-log-2026-10-28",
      );
      orgs.set(o.external_ref, o);
    }
    if (typeHint && o.source === "outreach-log-2026-10-28") o.type = typeHint;
    const to = firstEmail(r["to"] ?? "");
    if (to) fill(o, { email: to });
    if (person && person.includes(",")) {
      const [pname, ...role] = person.split(",");
      addContact(o, { name: pname!.trim(), role: role.join(",").trim(), email: to });
    }
    const channel: Channel = /form|^https?:/.test(r["channel"] ?? "") ? "form" : "email";
    const date = r["date"] ?? "";
    const base = `outreach:${date}:${slug(o.name)}:${channel}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    addInteraction(o, n > 1 ? `${base}:${n}` : base, {
      channel,
      date,
      direction: "out",
      subject: nn(r["subject"]),
      summary: nn(
        [channel === "form" ? "Form submitted" : "Email sent", r["notes"]]
          .filter(Boolean)
          .join(". "),
      ),
    });
    bump(o, "contacted");
    if (r["follow_up_due"] && !o.next_step) {
      o.next_step = "Follow-up email if no reply";
      o.next_step_due = r["follow_up_due"];
    }
  }
}

function importSpotmapper() {
  if (!SPOTMAPPER_CSV)
    return console.warn("CRM_SPOTMAPPER_CSV not set, skipping Spotmapper visits.");
  for (const r of readCsv(SPOTMAPPER_CSV)) {
    const lat = Number(r["lat"]);
    const lon = Number(r["lng"]);
    const name = r["place_name"]!;
    let o = findOrg(name, { near: [lat, lon] });
    if (!o) {
      o = blank(`spotmapper:${r["id"]}`, name, "restaurant", "spotmapper");
      fill(o, { lat, lon, category: nn(r["address"]) });
      orgs.set(o.external_ref, o);
    }
    fill(o, { tags: ["visited"] });
    const people = JSON.parse(r["people"] || "[]") as string[];
    const date = (r["created_at"] ?? "").slice(0, 10);
    const status = r["status"];
    addInteraction(o, `spotmapper-visit:${r["id"]}`, {
      channel: "visit",
      date,
      people,
      summary: nn(r["notes"]) ?? (status === "no_success" ? "No success" : "Good conversation"),
    });
    if (status === "no_success") {
      if (o.stage !== "pilot_partner") {
        o.stage = "declined";
        o.declined_reason ??= "Don't go back (Spotmapper)";
      }
    } else bump(o, "responded");
    if (status === "follow_up" && !o.next_step) {
      o.next_step = "Follow up after visit";
      o.next_step_due = date;
    }
    if (r["follow_up_sent"] === "true")
      addInteraction(o, `spotmapper-followup:${r["id"]}`, {
        channel: "email",
        date,
        people,
        summary: "Follow-up sent after the visit (from Spotmapper, date unknown)",
      });
  }
}

type Override = {
  match: string;
  create?: { name: string; type: OrgType; city?: string };
  stage?: Stage;
  declined_reason?: string;
  do_not_contact?: boolean;
  tags_add?: string[];
  notes_append?: string;
  contacts?: Partial<ContactRow>[];
  interactions?: { date: string; channel: Channel; direction: "in" | "out"; summary: string }[];
} & Partial<
  Pick<OrgRow, "promised" | "they_asked" | "pitch_angle" | "next_step" | "next_step_due">
>;

function applyOverrides(list: Override[]) {
  for (const ov of list) {
    const m = norm(ov.match);
    let o = [...orgs.values()].find((x) => norm(x.name).includes(m));
    if (!o && ov.create) {
      o = blank(`manual:${slug(ov.create.name)}`, ov.create.name, ov.create.type, "manual");
      fill(o, { city: ov.create.city ?? null });
      orgs.set(o.external_ref, o);
    }
    if (!o) {
      console.warn(`Override "${ov.match}" matched nothing.`);
      continue;
    }
    if (ov.stage) o.stage = ov.stage;
    if (ov.declined_reason) o.declined_reason = ov.declined_reason;
    if (ov.do_not_contact) o.do_not_contact = true;
    if (ov.tags_add) fill(o, { tags: ov.tags_add });
    if (ov.notes_append) addNote(o, ov.notes_append);
    for (const k of [
      "promised",
      "they_asked",
      "pitch_angle",
      "next_step",
      "next_step_due",
    ] as const)
      if (ov[k] !== undefined) o[k] = ov[k] ?? null;
    for (const c of ov.contacts ?? []) addContact(o, c);
    for (const [i, it] of (ov.interactions ?? []).entries())
      addInteraction(o, `reply:${slug(o.name)}:${it.date}:${i}`, { ...it, subject: null });
  }
}

// ---------- geocoding (PDOK for addresses, OSM by name, city centre as last resort) ----------

const cache: Record<string, [number, number, string] | null> = existsSync(GEOCODE_CACHE)
  ? JSON.parse(readFileSync(GEOCODE_CACHE, "utf8"))
  : {};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pdok(q: string, fq: string): Promise<[number, number, string] | null> {
  const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(q)}&fq=${fq}&rows=1&fl=centroide_ll,weergavenaam`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return null;
  const doc = (
    (await res.json()) as {
      response?: { docs?: { centroide_ll?: string; weergavenaam?: string }[] };
    }
  ).response?.docs?.[0];
  const m = doc?.centroide_ll?.match(/POINT\(([\d.]+) ([\d.]+)\)/);
  return m ? [Number(m[2]), Number(m[1]), doc?.weergavenaam ?? ""] : null;
}

async function osmByName(name: string, city: string): Promise<[number, number, string] | null> {
  const esc = name.replace(/[\\"]/g, "").replace(/[.*+?^${}()|[\]]/g, "\\$&");
  const q = `[out:json][timeout:20];area["name"="${city.replace(/"/g, "")}"]["boundary"="administrative"]->.a;nwr(area.a)["name"~"^${esc}$",i];out center 1;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: new URLSearchParams({ data: q }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) return null;
  const e = (
    (await res.json()) as {
      elements: { lat?: number; lon?: number; center?: { lat: number; lon: number } }[];
    }
  ).elements[0];
  const lat = e?.lat ?? e?.center?.lat;
  const lon = e?.lon ?? e?.center?.lon;
  return lat != null && lon != null ? [lat, lon, "osm"] : null;
}

async function geocode() {
  const todo = [...orgs.values()].filter((o) => o.lat == null);
  let done = 0;
  for (const o of todo) {
    const city = o.city ? cityOf(o.city) : "";
    const key = `${o.name}|${o.address ?? ""}|${o.postcode ?? ""}|${city}`;
    if (!(key in cache)) {
      let hit: [number, number, string] | null = null;
      if (o.address || o.postcode)
        hit = await pdok([o.address, o.postcode, city].filter(Boolean).join(" "), "type:adres");
      if (!hit && city) {
        hit = await osmByName(o.name, city).catch(() => null);
        await sleep(1100);
      }
      if (!hit && city) {
        const c = await pdok(city, "type:woonplaats");
        hit = c && [c[0], c[1], "city"];
      }
      cache[key] = hit;
    }
    const hit = cache[key];
    if (hit) {
      o.lat = hit[0];
      o.lon = hit[1];
      if (hit[2] === "city") fill(o, { tags: ["approx-location"] });
    }
    if (++done % 25 === 0) {
      console.log(`  geocoded ${done}/${todo.length}`);
      writeFileSync(GEOCODE_CACHE, JSON.stringify(cache));
    }
  }
  writeFileSync(GEOCODE_CACHE, JSON.stringify(cache));
}

// ---------- write ----------

async function write() {
  const url = env("VITE_SUPABASE_URL") || env("SUPABASE_URL");
  const key = env("VITE_SUPABASE_PUBLISHABLE_KEY") || env("SUPABASE_PUBLISHABLE_KEY");
  const email = env("TRUFFLE_CRM_EMAIL");
  const password = env("TRUFFLE_CRM_PASSWORD");
  if (!url || !key)
    throw new Error("Run from ~/truffle so Bun loads .env (Supabase URL and publishable key).");
  if (!email || !password)
    throw new Error("Set TRUFFLE_CRM_EMAIL and TRUFFLE_CRM_PASSWORD (a crm_team member).");
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { error: authError } = await sb.auth.signInWithPassword({ email, password });
  if (authError) throw authError;

  const upsert = async (table: string, rows: object[]) => {
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await sb
        .from(table)
        .upsert(rows.slice(i, i + 200), { onConflict: "external_ref", ignoreDuplicates: !REFRESH });
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  };

  await upsert("organizations", [...orgs.values()]);
  const ids = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("organizations")
      .select("id, external_ref")
      .range(from, from + 999);
    if (error) throw error;
    for (const r of data ?? []) if (r.external_ref) ids.set(r.external_ref, r.id);
    if (!data || data.length < 1000) break;
  }
  const withOrg = <T extends { org_ref: string }>(rows: T[]) =>
    rows.flatMap(({ org_ref, ...rest }) =>
      ids.has(org_ref) ? [{ ...rest, org_id: ids.get(org_ref) }] : [],
    );
  await upsert("contacts", withOrg([...contacts.values()]));
  await upsert("interactions", withOrg([...interactions.values()]));
  await sb.auth.signOut();
}

// ---------- main ----------

const overrides = existsSync(OVERRIDES)
  ? (JSON.parse(readFileSync(OVERRIDES, "utf8")) as {
      types?: Record<string, OrgType>;
      orgs?: Override[];
    })
  : {};

importSuppliers();
importAccountants();
importLeads();
importRestaurants();
importOutreach(overrides.types ?? {});
importSpotmapper();
applyOverrides(overrides.orgs ?? []);
await geocode();

const count = (f: (o: OrgRow) => string) =>
  [...orgs.values()].reduce<Record<string, number>>(
    (a, o) => ((a[f(o)] = (a[f(o)] ?? 0) + 1), a),
    {},
  );
console.log({
  organizations: orgs.size,
  byType: count((o) => o.type),
  byStage: count((o) => o.stage),
  withoutLocation: [...orgs.values()].filter((o) => o.lat == null).map((o) => o.name),
  approxLocation: [...orgs.values()].filter((o) => o.tags.includes("approx-location")).length,
  contacts: contacts.size,
  interactions: interactions.size,
});

if (DRY) {
  const out = env("CRM_DRY_RUN_OUT");
  if (out)
    writeFileSync(
      out,
      JSON.stringify(
        {
          orgs: [...orgs.values()],
          contacts: [...contacts.values()],
          interactions: [...interactions.values()],
        },
        null,
        1,
      ),
    );
  console.log("Dry run: nothing written.");
} else {
  await write();
  console.log(REFRESH ? "Imported (refreshed existing rows)." : "Imported (new rows only).");
}
