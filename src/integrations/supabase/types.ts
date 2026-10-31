export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      contact_submissions: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          venue: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          venue: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          venue?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          created_at: string
          email: string | null
          external_ref: string | null
          id: string
          linkedin: string | null
          name: string | null
          notes: string | null
          org_id: string
          phone: string | null
          role: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          external_ref?: string | null
          id?: string
          linkedin?: string | null
          name?: string | null
          notes?: string | null
          org_id: string
          phone?: string | null
          role?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          external_ref?: string | null
          id?: string
          linkedin?: string | null
          name?: string | null
          notes?: string | null
          org_id?: string
          phone?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_team: {
        Row: {
          created_at: string
          email: string
          name: string | null
        }
        Insert: {
          created_at?: string
          email: string
          name?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          name?: string | null
        }
        Relationships: []
      }
      interactions: {
        Row: {
          channel: Database["public"]["Enums"]["crm_channel"]
          contact_id: string | null
          created_at: string
          created_by: string | null
          date: string
          direction: Database["public"]["Enums"]["crm_direction"]
          external_ref: string | null
          id: string
          next_step: string | null
          next_step_due: string | null
          org_id: string
          people: string[]
          subject: string | null
          summary: string | null
        }
        Insert: {
          channel: Database["public"]["Enums"]["crm_channel"]
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          direction?: Database["public"]["Enums"]["crm_direction"]
          external_ref?: string | null
          id?: string
          next_step?: string | null
          next_step_due?: string | null
          org_id: string
          people?: string[]
          subject?: string | null
          summary?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["crm_channel"]
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          direction?: Database["public"]["Enums"]["crm_direction"]
          external_ref?: string | null
          id?: string
          next_step?: string | null
          next_step_due?: string | null
          org_id?: string
          people?: string[]
          subject?: string | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          category: string | null
          city: string | null
          created_at: string
          declined_reason: string | null
          do_not_contact: boolean
          email: string | null
          external_ref: string | null
          hook: string | null
          id: string
          instagram: string | null
          lat: number | null
          lon: number | null
          name: string
          next_step: string | null
          next_step_due: string | null
          notes: string | null
          opened_year: number | null
          opening_hours: string | null
          owner_name: string | null
          phone: string | null
          pitch_angle: string | null
          pos_hint: string | null
          postcode: string | null
          promised: string | null
          size_note: string | null
          source: string | null
          stage: Database["public"]["Enums"]["crm_stage"]
          tags: string[]
          they_asked: string | null
          type: Database["public"]["Enums"]["crm_org_type"]
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          city?: string | null
          created_at?: string
          declined_reason?: string | null
          do_not_contact?: boolean
          email?: string | null
          external_ref?: string | null
          hook?: string | null
          id?: string
          instagram?: string | null
          lat?: number | null
          lon?: number | null
          name: string
          next_step?: string | null
          next_step_due?: string | null
          notes?: string | null
          opened_year?: number | null
          opening_hours?: string | null
          owner_name?: string | null
          phone?: string | null
          pitch_angle?: string | null
          pos_hint?: string | null
          postcode?: string | null
          promised?: string | null
          size_note?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["crm_stage"]
          tags?: string[]
          they_asked?: string | null
          type?: Database["public"]["Enums"]["crm_org_type"]
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          category?: string | null
          city?: string | null
          created_at?: string
          declined_reason?: string | null
          do_not_contact?: boolean
          email?: string | null
          external_ref?: string | null
          hook?: string | null
          id?: string
          instagram?: string | null
          lat?: number | null
          lon?: number | null
          name?: string
          next_step?: string | null
          next_step_due?: string | null
          notes?: string | null
          opened_year?: number | null
          opening_hours?: string | null
          owner_name?: string | null
          phone?: string | null
          pitch_angle?: string | null
          pos_hint?: string | null
          postcode?: string | null
          promised?: string | null
          size_note?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["crm_stage"]
          tags?: string[]
          they_asked?: string | null
          type?: Database["public"]["Enums"]["crm_org_type"]
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_crm_member: { Args: never; Returns: boolean }
    }
    Enums: {
      crm_channel: "email" | "call" | "visit" | "form" | "dm" | "meeting"
      crm_direction: "out" | "in"
      crm_org_type:
        | "restaurant"
        | "supplier"
        | "wholesaler"
        | "accountant"
        | "pos_vendor"
        | "accounting_vendor"
        | "association"
        | "other"
      crm_stage:
        | "researched"
        | "enriched"
        | "contacted"
        | "responded"
        | "in_conversation"
        | "pilot_partner"
        | "declined"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      crm_channel: ["email", "call", "visit", "form", "dm", "meeting"],
      crm_direction: ["out", "in"],
      crm_org_type: [
        "restaurant",
        "supplier",
        "wholesaler",
        "accountant",
        "pos_vendor",
        "accounting_vendor",
        "association",
        "other",
      ],
      crm_stage: [
        "researched",
        "enriched",
        "contacted",
        "responded",
        "in_conversation",
        "pilot_partner",
        "declined",
      ],
    },
  },
} as const
