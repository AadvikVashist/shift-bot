export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          variables?: Json
          extensions?: Json
          query?: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      engineers: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string
          id: string
          is_on_call: boolean
          name: string
          phone_number: string | null
          slack_id: string | null
          telegram_id: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email: string
          id?: string
          is_on_call?: boolean
          name: string
          phone_number?: string | null
          slack_id?: string | null
          telegram_id?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string
          id?: string
          is_on_call?: boolean
          name?: string
          phone_number?: string | null
          slack_id?: string | null
          telegram_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ticket_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["action_type"]
          actor_engineer_id: string | null
          actor_external_id: string | null
          content: string | null
          created_at: string
          escalation_method:
            | Database["public"]["Enums"]["escalation_method"]
            | null
          escalation_needed: boolean | null
          id: string
          retry_count: number
          severity: number | null
          thinking_data: Json | null
          ticket_id: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["action_type"]
          actor_engineer_id?: string | null
          actor_external_id?: string | null
          content?: string | null
          created_at?: string
          escalation_method?:
            | Database["public"]["Enums"]["escalation_method"]
            | null
          escalation_needed?: boolean | null
          id?: string
          retry_count?: number
          severity?: number | null
          thinking_data?: Json | null
          ticket_id: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["action_type"]
          actor_engineer_id?: string | null
          actor_external_id?: string | null
          content?: string | null
          created_at?: string
          escalation_method?:
            | Database["public"]["Enums"]["escalation_method"]
            | null
          escalation_needed?: boolean | null
          id?: string
          retry_count?: number
          severity?: number | null
          thinking_data?: Json | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_actions_actor_engineer_id_fkey"
            columns: ["actor_engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_actions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          current_engineer_id: string | null
          id: string
          last_activity_at: string
          platform: Database["public"]["Enums"]["platform"]
          received_at: string
          status: Database["public"]["Enums"]["ticket_status"]
          thread_id: string | null
          updated_at: string
          user_external_id: string
        }
        Insert: {
          current_engineer_id?: string | null
          id?: string
          last_activity_at?: string
          platform: Database["public"]["Enums"]["platform"]
          received_at?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          thread_id?: string | null
          updated_at?: string
          user_external_id: string
        }
        Update: {
          current_engineer_id?: string | null
          id?: string
          last_activity_at?: string
          platform?: Database["public"]["Enums"]["platform"]
          received_at?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          thread_id?: string | null
          updated_at?: string
          user_external_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_current_engineer_id_fkey"
            columns: ["current_engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      action_type:
        | "user_message"
        | "llm_answer"
        | "escalation_call"
        | "engineer_note"
        | "system_event"
      escalation_method: "telegram_voice" | "phone_call"
      platform: "telegram" | "slack"
      ticket_status:
        | "open"
        | "auto_answered"
        | "awaiting_feedback"
        | "escalation_pending"
        | "escalated"
        | "closed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      action_type: [
        "user_message",
        "llm_answer",
        "escalation_call",
        "engineer_note",
        "system_event",
      ],
      escalation_method: ["telegram_voice", "phone_call"],
      platform: ["telegram", "slack"],
      ticket_status: [
        "open",
        "auto_answered",
        "awaiting_feedback",
        "escalation_pending",
        "escalated",
        "closed",
      ],
    },
  },
} as const

