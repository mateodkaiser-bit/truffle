import type { Channel, OrgType, Stage } from "./types";

export const STAGE_META: Record<Stage, { label: string; color: string }> = {
  researched: { label: "Researched", color: "#B9B1A7" },
  enriched: { label: "Enriched", color: "#6F8FAF" },
  contacted: { label: "Emailed", color: "#D4A24C" },
  responded: { label: "Responded", color: "#9A80BE" },
  in_conversation: { label: "In conversation", color: "#2F8C9B" },
  pilot_partner: { label: "Pilot / partner", color: "#2F6B3F" },
  declined: { label: "Declined", color: "#C0705F" },
};

export const TYPE_LABEL: Record<OrgType, string> = {
  restaurant: "Restaurant",
  supplier: "Supplier",
  wholesaler: "Wholesaler",
  accountant: "Accountant",
  pos_vendor: "POS vendor",
  accounting_vendor: "Accounting software",
  association: "Association",
  other: "Other",
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  visit: "Visit",
  call: "Call",
  email: "Email",
  dm: "DM",
  meeting: "Meeting",
  form: "Form",
};

/** Dark ring around places the team visited in person, on the map and in the legend. */
export const VISITED_COLOR = "#2B2124";
/** Soft gold halo behind the most promising places nobody has contacted or visited yet. */
export const PROMISING_COLOR = "#E8C25A";
/** Colour for lead pipeline places nobody has reached yet. */
export const PIPELINE_COLOR = "#A8B48E";
