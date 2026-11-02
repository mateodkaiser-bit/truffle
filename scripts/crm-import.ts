// Import CRM data from local lead files into Supabase. Run locally with Bun; see README "CRM import".
//
//   bun scripts/crm-import.ts --dry-run                  # build everything, print a summary, write nothing
//   bun scripts/crm-import.ts                            # asks your team email, signs in by emailed link
//   ... --all-leads                                        # every pipeline lead, not only open restaurants
//
// The data files stay outside this public repo. Nothing from ~/truffle-pilots/raw or any invoice
// data is read. The script signs in as a team member, so row level security applies as in the app.
// Rows are keyed on external_ref: a re-run only adds new rows and leaves edits made in the app alone,
// unless --refresh is passed (then import-owned fields are overwritten).
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { createClient } from "@supabase/supabase-js";
import { crmClient, endScriptSession, scriptSignIn } from "./crm-session";
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
const ALL_LEADS = args.has("--all-leads");
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
  pancake: join(DATA, "pancake-leads-2026-11-01.csv"),
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
  opts: { type?: OrgType; notType?: OrgType; city?: string; near?: [number, number] } = {},
) {
  const key = norm(name);
  if (key.length < 3) return undefined;
  const all = [...orgs.values()].filter(
    (o) => (!opts.type || o.type === opts.type) && (!opts.notType || o.type !== opts.notType),
  );
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

/** Latest data/<prefix>-DATE.csv from the lead pipeline, or undefined. */
function latestLeadFile(prefix: string) {
  if (!existsSync(LEADS_DIR)) return undefined;
  const re = new RegExp(`^${prefix}-\\d{4}-\\d{2}-\\d{2}\\.csv$`);
  return readdirSync(LEADS_DIR)
    .filter((f) => re.test(f))
    .sort()
    .at(-1);
}

const LEAD_TYPES = new Set(["restaurant", "cafe"]);

/** Fields the lead pipeline owns: refreshed on every run without touching the team's edits. */
const leadRefresh = new Map<string, Partial<OrgRow>>();
const PIPELINE_LINE = /bij jullie/;

/** One pipeline lead (truffle-leads score.py export) as an organisation, keyed on lead_id. */
const ownerHints = new Map<string, string>();

function applyOwnerHints() {
  let n = 0;
  for (const [ref, name] of ownerHints) {
    const o = orgs.get(ref);
    if (o && !o.owner_name) {
      o.owner_name = name;
      addNote(o, `Owner name from the restaurant's own website (${name}): check before using it.`);
      n++;
    }
  }
  console.log(`Owner names from restaurant websites: ${n}`);
}

function leadOrg(r: Row, source: string, openers: Map<string, string>) {
  const leadId = r["lead_id"]!;
  const status = r["status"] || "unverified";
  const signals = r["signals"] ?? "";
  const o = blank(`lead:${leadId}`, r["name"] || r["address"] || leadId, "restaurant", source);
  const permits = [r["first_permit"], r["latest_permit"]].filter(Boolean);
  fill(o, {
    category:
      nn(r["cuisine"]?.replace(/;/g, ", ") ?? "") ?? nn((r["type"] ?? "").replace(/_/g, " ")),
    city: nn(r["municipality"]),
    address: nn(r["address"]),
    postcode: nn(r["postcode"]),
    lat: r["lat"] ? Number(r["lat"]) : null,
    lon: r["lon"] ? Number(r["lon"]) : null,
    website: nn(r["website"]),
    email: firstEmail(r["email"] ?? ""),
    instagram: nn(r["instagram"]),
    phone: nn(r["phone"]),
    opened_year:
      Number(
        signals.match(/since (\d{4})/)?.[1] ?? signals.match(/site says opened (\d{4})/)?.[1],
      ) || null,

    pos_hint:
      signals.match(/lightspeed|tebi|untill|mr\.? ?winston|qr\/other pos/gi)?.join(", ") ?? null,
    hook: nn(signals),
    pitch_angle: openers.get(leadId) ?? null,
    notes: [
      `Lead score ${r["score"]}. Status: ${status}${r["status_reasons"] ? ` (${r["status_reasons"]})` : ""}.`,
      permits.length > 0 &&
        `Permits ${r["permit_kinds"] ? `(${r["permit_kinds"]}) ` : ""}${[...new Set(permits)].join(" to ")}: ${r["permit_url"]}`,
    ]
      .filter(Boolean)
      .join("\n"),
    tags: [
      `lead-${status.replace(/_/g, "-")}`,
      r["type"] ?? "",
      openers.has(leadId) ? "price-insight" : "",
      // Signals from the Amsterdam register, domain age and cached homepages (2026-11-02)
      /new operator\?|new owner/.test(signals) ? "new-operator" : "",
      /older business\?/.test(signals) ? "check-older-business" : "",
      /register permit ended/.test(signals) ? "check-permit-ended" : "",
      /several locations/.test(signals) ? "check-multi-site" : "",
      /delivery: /.test(signals) ? "delivery-platforms" : "",
    ].filter(Boolean),
  });
  // A name the restaurant's own site presents as owner or founder (page_signals.py). Applied after
  // every other source, so Pancake and hand research win; see applyOwnerHints().
  const ownerHint = signals.match(/owner on site: ([^;]+)/)?.[1]?.trim();
  if (ownerHint) ownerHints.set(o.external_ref, ownerHint);
  leadRefresh.set(o.external_ref, {
    hook: o.hook,
    pitch_angle: o.pitch_angle,
    notes: o.notes,
    tags: o.tags,
    lat: o.lat,
    lon: o.lon,
    website: o.website,
    email: o.email,
    instagram: o.instagram,
    phone: o.phone,
    opened_year: o.opened_year,
    pos_hint: o.pos_hint,
  });
  if (status === "likely_closed") {
    o.stage = "declined";
    o.declined_reason = `Likely closed: ${r["status_reasons"] || "see lead pipeline"}`;
  } else if (o.email || o.instagram || o.phone) o.stage = "enriched";
  return o;
}

/**
 * Lead pipeline exports in ~/truffle-leads/data (see its README), newest file of each kind. By
 * default every place with status open, plus unverified restaurants and cafes; --all-leads adds
 * the rest (to check, unmapped permit addresses) and the likely-closed file as declined.
 */
function importLeads() {
  const latest = latestLeadFile("leads");
  if (!latest)
    return console.warn(`No leads-DATE.csv in ${LEADS_DIR}, skipping the lead pipeline.`);
  const source = latest.replace(".csv", "");

  // Price lines per lead (insights osm_id is lead_id without "osm:"): the 3 dishes furthest
  // from the places around them, and only fair comparisons. A gap over 50% is usually a
  // different portion or a misread menu, and fewer than 5 nearby places is too thin a sample,
  // so those are left out.
  const byLead = new Map<string, { gap: number; line: string }[]>();
  const insights = latestLeadFile("insights");
  if (insights)
    for (const r of readCsv(join(LEADS_DIR, insights))) {
      if (!r["osm_id"] || !r["line"]) continue;
      const gap = Math.abs(Number(r["diff_pct"]) || 0);
      if (gap > 50 || Number(r["peers"]) < 5) continue;
      const id = `osm:${r["osm_id"]}`;
      // cost_context (cbs.py): national price trend for the dish's main ingredient, always "Bron: CBS".
      const line = r["cost_context"]
        ? `${r["line"]}\nKosten landelijk: ${r["cost_context"]}`
        : r["line"];
      byLead.set(id, [...(byLead.get(id) ?? []), { gap, line }]);
    }
  const openers = new Map(
    [...byLead].map(([id, rows]) => [
      id,
      rows
        .sort((a, b) => b.gap - a.gap)
        .slice(0, 3)
        .map((x) => x.line)
        .join("\n"),
    ]),
  );

  let n = 0;
  for (const r of readCsv(join(LEADS_DIR, latest))) {
    if (!r["lead_id"]) continue;
    // Open places of any kind; unverified restaurants and cafes too (hidden on the map by default).
    const keep =
      r["status"] === "open" || (r["status"] === "unverified" && LEAD_TYPES.has(r["type"] ?? ""));
    if (!ALL_LEADS && !keep) continue;
    const o = leadOrg(r, source, openers);
    orgs.set(o.external_ref, o);
    n++;
  }
  const closed = ALL_LEADS ? latestLeadFile("leads-closed") : undefined;
  if (closed)
    for (const r of readCsv(join(LEADS_DIR, closed))) {
      if (!r["lead_id"]) continue;
      const o = leadOrg(r, closed.replace(".csv", ""), openers);
      orgs.set(o.external_ref, o);
      n++;
    }
  console.log(
    `Leads: ${n} from ${latest}${closed ? ` and ${closed}` : ""}` +
      `${insights ? `, price lines from ${insights}` : ""}${ALL_LEADS ? "" : " (open places, plus unverified restaurants and cafes; --all-leads for the rest)"}`,
  );
}

const bareName = (n: string) =>
  norm(
    n.trim().replace(/^(restaurant|eetcaf[eé]|grand caf[eé]|caf[eé]|bar|brasserie|bistro)\s+/i, ""),
  );

/**
 * A pipeline lead that is also in another list (same email, or same name at the same postcode
 * or within 80 m) is folded into that organisation, so a place we already emailed or visited
 * keeps its history and shows up once. Returns lead ref -> the ref it was merged into.
 */
function mergeLeadDuplicates() {
  const merged = new Map<string, string>();
  const others = [...orgs.values()].filter((o) => !o.external_ref.startsWith("lead:"));
  for (const lead of [...orgs.values()].filter((o) => o.external_ref.startsWith("lead:"))) {
    const target = others.find(
      (o) =>
        (!!lead.email && !!o.email && lead.email.toLowerCase() === o.email.toLowerCase()) ||
        (bareName(o.name) === bareName(lead.name) &&
          ((!!o.postcode && o.postcode.replace(/\s/g, "") === lead.postcode?.replace(/\s/g, "")) ||
            (o.lat != null &&
              o.lon != null &&
              lead.lat != null &&
              lead.lon != null &&
              distM(o.lat, o.lon, lead.lat, lead.lon) < 80))),
    );
    if (!target) continue;
    const { external_ref: _ref, name: _name, stage, notes, ...rest } = lead;
    fill(target, rest);
    bump(target, stage);
    if (notes) addNote(target, notes);
    for (const c of contacts.values())
      if (c.org_ref === lead.external_ref) c.org_ref = target.external_ref;
    for (const i of interactions.values())
      if (i.org_ref === lead.external_ref) i.org_ref = target.external_ref;
    const refresh = leadRefresh.get(lead.external_ref);
    if (refresh) leadRefresh.set(target.external_ref, { ...refresh, notes: null });
    leadRefresh.delete(lead.external_ref);
    orgs.delete(lead.external_ref);
    merged.set(lead.external_ref, target.external_ref);
  }
  if (merged.size) console.log(`Merged ${merged.size} pipeline leads into places already listed.`);
  return merged;
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
    // Rows without a prefix went to suppliers: look there first, so a supplier isn't lost
    // among the thousands of restaurant leads with similar names.
    let o = type
      ? findOrg(name, { type })
      : (findOrg(name, { notType: "restaurant" }) ?? findOrg(name));
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

const hostOf = (u: string | null | undefined) =>
  (u ?? "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0] ?? "";

/**
 * Restaurant owners found with Pancake during the November 2026 trial (owner name, LinkedIn,
 * work email), curated to real restaurants. Matches a known place by website domain, then by
 * name; otherwise adds the restaurant. The owner becomes a contact, and tags record what the
 * data proves for the lead score: pancake, owner-known, owner-email (an address on the
 * restaurant's own domain) and linkedin-engaged (they reacted to a post about horeca costs).
 */
const pancakeRefs = new Set<string>();
const PANCAKE_TAG =
  /^(pancake|owner-known|owner-email|linkedin-engaged|horeca-influencer|site-down)/;

function importPancake() {
  if (!existsSync(FILES.pancake)) return console.warn(`No ${FILES.pancake}, skipping Pancake.`);
  let matched = 0;
  let added = 0;
  for (const r of readCsv(FILES.pancake)) {
    if (!r["lead_id"] || !r["employer"]) continue;
    const domain = hostOf(r["company_domain"]);
    let o = domain
      ? [...orgs.values()].find((x) => x.type === "restaurant" && hostOf(x.website) === domain)
      : undefined;
    o ??= findOrg(r["employer"], { type: "restaurant", city: r["city"] || undefined });
    if (o) matched++;
    else {
      o = blank(`pancake:${r["lead_id"]}`, r["employer"], "restaurant", "pancake-2026-11-01");
      fill(o, { city: nn(r["city"]), website: domain ? `https://${domain}` : null });
      orgs.set(o.external_ref, o);
      added++;
    }
    const email = nn(r["work_email"]);
    const ownDomain = !!email && !!domain && email.toLowerCase().endsWith(`@${domain}`);
    fill(o, {
      owner_name: nn(r["name"]),
      hook: nn(r["signal"]),
      opened_year: Number(r["opened"]) || null,
      tags: [
        "pancake",
        "owner-known",
        ownDomain ? "owner-email" : "",
        r["signal"] ? "linkedin-engaged" : "",
        r["influencer"] ? "horeca-influencer" : "",
        r["grade"] ? `pancake-grade-${r["grade"].toLowerCase()}` : "",
        r["grade"] === "C" ? "pancake-unconfirmed" : "",
        r["site"] === "down" ? "site-down" : "",
      ].filter(Boolean),
    });
    if (r["note"] && !o.notes?.includes(r["note"])) addNote(o, `Pancake: ${r["note"]}`);
    addContact(o, {
      name: r["name"],
      role: r["title"],
      email: email ?? undefined,
      linkedin: r["linkedin_url"],
      notes: [
        `Found with Pancake (${r["play"]} search, ${r["fit"]}).`,
        email && !ownDomain && `Email is on another domain (${email.split("@")[1]}): check first.`,
      ]
        .filter(Boolean)
        .join(" "),
    });
    if (email) bump(o, "enriched");
    pancakeRefs.add(o.external_ref);
  }
  console.log(`Pancake: ${matched} owners matched to known places, ${added} new restaurants`);
}

/**
 * Places that were already in the CRM get the Pancake findings too, without --refresh: its tags
 * are added, owner and opening year fill only empty fields, and "Pancake:" notes are appended once.
 */
async function refreshPancakeFields(
  sb: ReturnType<typeof createClient>,
  merged: Map<string, string>,
) {
  const refs = [...new Set([...pancakeRefs].map((r) => merged.get(r) ?? r))];
  let n = 0;
  for (let i = 0; i < refs.length; i += 100) {
    const { data, error } = await sb
      .from("organizations")
      .select("id, external_ref, tags, owner_name, opened_year, notes")
      .in("external_ref", refs.slice(i, i + 100));
    if (error) throw new Error(`organizations: ${error.message}`);
    for (const cur of (data ?? []) as Pick<
      Organization,
      "id" | "tags" | "owner_name" | "opened_year" | "notes"
    >[] &
      { external_ref: string }[]) {
      const next = orgs.get(cur.external_ref);
      if (!next) continue;
      const patch: Partial<OrgRow> = {};
      const tags = [...new Set([...cur.tags, ...next.tags.filter((t) => PANCAKE_TAG.test(t))])];
      if (tags.length !== cur.tags.length) patch.tags = tags;
      if (!cur.owner_name && next.owner_name) patch.owner_name = next.owner_name;
      if (!cur.opened_year && next.opened_year) patch.opened_year = next.opened_year;
      const add = (next.notes ?? "")
        .split("\n")
        .filter((l) => l.startsWith("Pancake: ") && !cur.notes?.includes(l));
      if (add.length) patch.notes = [cur.notes, ...add].filter(Boolean).join("\n");
      if (!Object.keys(patch).length) continue;
      const { error: e } = await sb.from("organizations").update(patch).eq("id", cur.id);
      if (e) throw new Error(`organizations: ${e.message}`);
      n++;
    }
  }
  console.log(`Added Pancake findings to ${n} places already in the CRM.`);
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

// ---------- patches (findings added without code changes) ----------

// Small JSON files in CRM_PATCH_DIR (default <CRM_DATA_DIR>/crm-patches), each an array of
// { ref | match, tags_add?, notes_append?, next_step?, next_step_due?, pitch_angle?, do_not_contact? }.
// `ref` is an organisation's external_ref (exact), `match` a lowercase name substring. Patches only
// add: tags are joined, a note is appended once, next step and pitch fill empty fields only, and
// do_not_contact can only be switched on. They never change a stage or delete anything, on new
// rows and on rows the team already edited in the app.
const PATCH_DIR = env("CRM_PATCH_DIR", join(DATA, "crm-patches"));
type Patch = {
  ref?: string;
  match?: string;
  tags_add?: string[];
  notes_append?: string;
  do_not_contact?: boolean;
} & Partial<Pick<OrgRow, "next_step" | "next_step_due" | "pitch_angle">>;
const PATCH_KEYS = new Set([
  "ref",
  "match",
  "tags_add",
  "notes_append",
  "next_step",
  "next_step_due",
  "pitch_angle",
  "do_not_contact",
]);
const PATCH_FIELDS = ["next_step", "next_step_due", "pitch_angle"] as const;
const patched = new Map<string, Patch[]>();

function importPatches(merged: Map<string, string>) {
  if (!existsSync(PATCH_DIR)) return;
  let n = 0;
  let missed = 0;
  for (const f of readdirSync(PATCH_DIR)
    .filter((x) => x.endsWith(".json"))
    .sort()) {
    const list: unknown = JSON.parse(readFileSync(join(PATCH_DIR, f), "utf8"));
    if (!Array.isArray(list)) {
      console.warn(`Patch file ${f} is not a JSON array, skipped.`);
      continue;
    }
    for (const p of list as Patch[]) {
      const bad = Object.keys(p).filter((k) => !PATCH_KEYS.has(k));
      if (bad.length || (!p.ref && !p.match)) {
        console.warn(
          `Patch in ${f} skipped: ${bad.length ? `unknown keys ${bad.join(", ")}` : "no ref or match"}.`,
        );
        continue;
      }
      const m = norm(p.match ?? "");
      const o = p.ref
        ? orgs.get(merged.get(p.ref) ?? p.ref)
        : [...orgs.values()].find((x) => norm(x.name).includes(m));
      if (!o) {
        missed++;
        continue;
      }
      fill(o, { tags: p.tags_add ?? [] });
      if (p.notes_append && !o.notes?.includes(p.notes_append)) addNote(o, p.notes_append);
      for (const k of PATCH_FIELDS) if (p[k] && !o[k]) o[k] = p[k] ?? null;
      if (p.do_not_contact) o.do_not_contact = true;
      patched.set(o.external_ref, [...(patched.get(o.external_ref) ?? []), p]);
      n++;
    }
  }
  console.log(
    `Patches: ${n} applied from ${PATCH_DIR}${missed ? `, ${missed} matched nothing` : ""}.`,
  );
}

/** Owner names from restaurant websites for rows already in the CRM: only where nobody named one. */
async function refreshOwnerHints(sb: ReturnType<typeof createClient>) {
  const refs = [...ownerHints.keys()];
  let n = 0;
  for (let i = 0; i < refs.length; i += 100) {
    const { data, error } = await sb
      .from("organizations")
      .select("id, external_ref, owner_name, notes")
      .in("external_ref", refs.slice(i, i + 100))
      .is("owner_name", null);
    if (error) throw new Error(`organizations: ${error.message}`);
    for (const cur of (data ?? []) as (Pick<Organization, "id" | "notes"> & {
      external_ref: string;
    })[]) {
      const name = ownerHints.get(cur.external_ref);
      if (!name) continue;
      const note = `Owner name from the restaurant's own website (${name}): check before using it.`;
      const { error: e } = await sb
        .from("organizations")
        .update({ owner_name: name, notes: [cur.notes, note].filter(Boolean).join("\n") })
        .eq("id", cur.id);
      if (e) throw new Error(`organizations: ${e.message}`);
      n++;
    }
  }
  if (refs.length)
    console.log(`Added owner names from websites to ${n} places already in the CRM.`);
}

/** Add patch findings to rows already in the CRM, without touching what the team changed. */
async function refreshPatchedFields(sb: ReturnType<typeof createClient>) {
  const refs = [...patched.keys()];
  let n = 0;
  for (let i = 0; i < refs.length; i += 100) {
    const { data, error } = await sb
      .from("organizations")
      .select(
        "id, external_ref, tags, notes, next_step, next_step_due, pitch_angle, do_not_contact",
      )
      .in("external_ref", refs.slice(i, i + 100));
    if (error) throw new Error(`organizations: ${error.message}`);
    for (const cur of (data ?? []) as (Pick<
      Organization,
      "id" | "tags" | "notes" | "next_step" | "next_step_due" | "pitch_angle" | "do_not_contact"
    > & { external_ref: string })[]) {
      const ps = patched.get(cur.external_ref) ?? [];
      const update: Partial<OrgRow> = {};
      const tags = [...new Set([...cur.tags, ...ps.flatMap((p) => p.tags_add ?? [])])];
      if (tags.length !== cur.tags.length) update.tags = tags;
      const add = ps
        .map((p) => p.notes_append)
        .filter((x): x is string => !!x && !cur.notes?.includes(x));
      if (add.length) update.notes = [cur.notes, ...new Set(add)].filter(Boolean).join("\n");
      for (const k of PATCH_FIELDS) {
        const v = ps.find((p) => p[k])?.[k];
        if (v && !cur[k]) update[k] = v;
      }
      if (ps.some((p) => p.do_not_contact) && !cur.do_not_contact) update.do_not_contact = true;
      if (!Object.keys(update).length) continue;
      const { error: e } = await sb.from("organizations").update(update).eq("id", cur.id);
      if (e) throw new Error(`organizations: ${e.message}`);
      n++;
    }
  }
  if (refs.length) console.log(`Added patch findings to ${n} places already in the CRM.`);
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
      // A failed request (timeout, 5xx) is not cached, so the next run tries again.
      let failed = false;
      const soft = <T>(p: Promise<T>) =>
        p.catch(() => {
          failed = true;
          return null;
        });
      let hit: [number, number, string] | null = null;
      if (o.address || o.postcode)
        hit = await soft(
          pdok([o.address, o.postcode, city].filter(Boolean).join(" "), "type:adres"),
        );
      if (!hit && city) {
        hit = await soft(osmByName(o.name, city));
        await sleep(1100);
      }
      if (!hit && city) {
        const c = await soft(pdok(city, "type:woonplaats"));
        hit = c && [c[0], c[1], "city"];
      }
      if (!failed || hit) cache[key] = hit;
    }
    const hit = cache[key] ?? null;
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

/**
 * Weekly reruns: update what the lead pipeline owns on rows that already exist (signals, price
 * lines, status tags, lead score note, missing contact details) and leave the team's edits alone.
 */
async function refreshLeadFields(sb: ReturnType<typeof createClient>, ids: Map<string, string>) {
  type Existing = Pick<
    Organization,
    | "id"
    | "external_ref"
    | "tags"
    | "notes"
    | "hook"
    | "pitch_angle"
    | "website"
    | "email"
    | "instagram"
    | "phone"
    | "lat"
    | "lon"
    | "opened_year"
    | "pos_hint"
  >;
  const existing = new Map<string, Existing>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("organizations")
      .select(
        "id, external_ref, tags, notes, hook, pitch_angle, website, email, instagram, phone, lat, lon, opened_year, pos_hint",
      )
      .range(from, from + 999);
    if (error) throw error;
    for (const r of (data ?? []) as Existing[]) if (r.external_ref) existing.set(r.external_ref, r);
    if (!data || data.length < 1000) break;
  }
  const patches: [string, Partial<OrgRow>][] = [];
  for (const [ref, next] of leadRefresh) {
    const cur = existing.get(ref);
    if (!cur || !ids.has(ref)) continue;
    const patch: Partial<OrgRow> = {};
    if (next.hook && next.hook !== cur.hook && (!cur.hook || cur.hook.startsWith("permit ")))
      patch.hook = next.hook;
    const pitch = next.pitch_angle ?? null;
    if (pitch !== cur.pitch_angle && (!cur.pitch_angle || PIPELINE_LINE.test(cur.pitch_angle)))
      patch.pitch_angle = pitch;
    if (next.notes) {
      let notes = cur.notes ?? "";
      for (const line of next.notes.split("\n")) {
        const key = line.startsWith("Lead score") ? /^Lead score .*$/m : /^Permits .*$/m;
        notes = key.test(notes)
          ? notes.replace(key, line)
          : [notes, line].filter(Boolean).join("\n");
      }
      if (notes !== cur.notes) patch.notes = notes;
    }
    const tags = [
      ...new Set([
        ...cur.tags.filter((t) => !/^lead-/.test(t) && t !== "price-insight"),
        ...(next.tags ?? []),
      ]),
    ];
    if ([...tags].sort().join() !== [...cur.tags].sort().join()) patch.tags = tags;
    for (const k of [
      "website",
      "email",
      "instagram",
      "phone",
      "lat",
      "lon",
      "opened_year",
      "pos_hint",
    ] as const)
      if (cur[k] == null && next[k] != null) (patch as Record<string, unknown>)[k] = next[k];
    if (Object.keys(patch).length) patches.push([cur.id, patch]);
  }
  for (let i = 0; i < patches.length; i += 20) {
    await Promise.all(
      patches.slice(i, i + 20).map(async ([id, patch]) => {
        const { error } = await sb.from("organizations").update(patch).eq("id", id);
        if (error) throw new Error(`organizations: ${error.message}`);
      }),
    );
  }
  console.log(`Refreshed pipeline fields on ${patches.length} existing places.`);
}

async function write() {
  const sb = crmClient();
  const stored = await scriptSignIn(sb);
  if (stored) console.log("Signed in with the stored CRM session (Keychain).");
  const { data: member } = await sb.rpc("is_crm_member");
  if (member !== true) throw new Error("Signed in, but this email is not on the crm_team list.");

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
  // Pipeline leads now folded into another organisation: move what was logged on the old row
  // to the one it belongs to, then remove the duplicate.
  for (const [leadRef, targetRef] of mergedLeads) {
    const from = ids.get(leadRef);
    const to = ids.get(targetRef);
    if (!from || !to) continue;
    for (const t of ["interactions", "contacts"] as const) {
      const { error } = await sb.from(t).update({ org_id: to }).eq("org_id", from);
      if (error) throw new Error(`${t}: ${error.message}`);
    }
    const { error } = await sb.from("organizations").delete().eq("id", from);
    if (error) throw new Error(`organizations: ${error.message}`);
    ids.delete(leadRef);
    console.log(`Folded duplicate ${leadRef} into ${targetRef}.`);
  }

  if (!REFRESH) await refreshLeadFields(sb, ids);
  if (!REFRESH) await refreshPancakeFields(sb, mergedLeads);
  await refreshPatchedFields(sb);
  await refreshOwnerHints(sb);

  const withOrg = <T extends { org_ref: string }>(rows: T[]) =>
    rows.flatMap(({ org_ref, ...rest }) =>
      ids.has(org_ref) ? [{ ...rest, org_id: ids.get(org_ref) }] : [],
    );
  await upsert("contacts", withOrg([...contacts.values()]));
  await upsert("interactions", withOrg([...interactions.values()]));
  await endScriptSession(sb);
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
importPancake();
const mergedLeads = mergeLeadDuplicates();
applyOverrides(overrides.orgs ?? []);
importPatches(mergedLeads);
applyOwnerHints();
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
  withoutLocation: [...orgs.values()].filter((o) => o.lat == null).length,
  withoutLocationSample: [...orgs.values()]
    .filter((o) => o.lat == null)
    .slice(0, 30)
    .map((o) => o.name),
  leadStatus: count((o) => o.tags.find((t) => t.startsWith("lead-")) ?? "not a pipeline lead"),
  withPriceLines: [...orgs.values()].filter((o) => o.tags.includes("price-insight")).length,
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
