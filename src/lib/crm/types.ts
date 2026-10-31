// CRM table types, written by hand to match supabase/migrations/20261101090000_crm.sql.
// Once Lovable regenerates src/integrations/supabase/types.ts with these tables, this file
// can import from there instead.

export const ORG_TYPES = [
  "restaurant",
  "supplier",
  "wholesaler",
  "accountant",
  "pos_vendor",
  "accounting_vendor",
  "association",
  "other",
] as const;
export type OrgType = (typeof ORG_TYPES)[number];

export const STAGES = [
  "researched",
  "enriched",
  "contacted",
  "responded",
  "in_conversation",
  "pilot_partner",
  "declined",
] as const;
export type Stage = (typeof STAGES)[number];

export const CHANNELS = ["visit", "call", "email", "dm", "meeting", "form"] as const;
export type Channel = (typeof CHANNELS)[number];
export type Direction = "out" | "in";

export type Organization = {
  id: string;
  external_ref: string | null;
  name: string;
  type: OrgType;
  stage: Stage;
  declined_reason: string | null;
  category: string | null;
  city: string | null;
  address: string | null;
  postcode: string | null;
  lat: number | null;
  lon: number | null;
  website: string | null;
  instagram: string | null;
  phone: string | null;
  email: string | null;
  opening_hours: string | null;
  size_note: string | null;
  tags: string[];
  source: string | null;
  opened_year: number | null;
  pos_hint: string | null;
  owner_name: string | null;
  hook: string | null;
  notes: string | null;
  promised: string | null;
  they_asked: string | null;
  pitch_angle: string | null;
  next_step: string | null;
  next_step_due: string | null;
  do_not_contact: boolean;
  created_at: string;
  updated_at: string;
};

export type Contact = {
  id: string;
  org_id: string;
  name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  notes: string | null;
  external_ref: string | null;
  created_at: string;
};

export type Interaction = {
  id: string;
  org_id: string;
  contact_id: string | null;
  channel: Channel;
  direction: Direction;
  date: string;
  subject: string | null;
  summary: string | null;
  next_step: string | null;
  next_step_due: string | null;
  people: string[];
  external_ref: string | null;
  created_by: string | null;
  created_at: string;
};

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type CrmDatabase = {
  public: {
    Tables: {
      organizations: Table<Organization>;
      contacts: Table<Contact>;
      interactions: Table<Interaction>;
      crm_team: Table<{ email: string; name: string | null; created_at: string }>;
    };
    Views: { [_ in never]: never };
    Functions: { is_crm_member: { Args: Record<string, never>; Returns: boolean } };
    Enums: {
      crm_org_type: OrgType;
      crm_stage: Stage;
      crm_channel: Channel;
      crm_direction: Direction;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
