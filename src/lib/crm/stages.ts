import type { Channel, OrgType, Stage } from "./types";

export const STAGE_META: Record<Stage, { label: string; color: string }> = {
  researched: { label: "Researched", color: "#9A938C" },
  enriched: { label: "Enriched", color: "#3B82F6" },
  contacted: { label: "Emailed", color: "#F59E0B" },
  responded: { label: "Responded", color: "#8B5CF6" },
  in_conversation: { label: "In conversation", color: "#0E9F8E" },
  pilot_partner: { label: "Pilot / partner", color: "#16A34A" },
  declined: { label: "Declined", color: "#B42318" },
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
