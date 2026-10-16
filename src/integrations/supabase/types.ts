export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      approvals: {
        Row: {
          action: string;
          actor_id: string | null;
          booking_id: string;
          created_at: string;
          id: string;
          reason: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          booking_id: string;
          created_at?: string;
          id?: string;
          reason?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          booking_id?: string;
          created_at?: string;
          id?: string;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "approvals_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approvals_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: Json;
          entity: string;
          entity_id: string | null;
          id: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json;
          entity: string;
          entity_id?: string | null;
          id?: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json;
          entity?: string;
          entity_id?: string | null;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          attendees: number;
          cancelled_at: string | null;
          cancelled_by: string | null;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          end_at: string;
          facilities: string[];
          id: string;
          purpose: string;
          rejection_reason: string | null;
          start_at: string;
          status: Database["public"]["Enums"]["booking_status"];
          title: string;
          user_id: string;
          venue_id: string;
        };
        Insert: {
          attendees: number;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          end_at: string;
          facilities?: string[];
          id?: string;
          purpose?: string;
          rejection_reason?: string | null;
          start_at: string;
          status?: Database["public"]["Enums"]["booking_status"];
          title: string;
          user_id: string;
          venue_id: string;
        };
        Update: {
          attendees?: number;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          end_at?: string;
          facilities?: string[];
          id?: string;
          purpose?: string;
          rejection_reason?: string | null;
          start_at?: string;
          status?: Database["public"]["Enums"]["booking_status"];
          title?: string;
          user_id?: string;
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_cancelled_by_fkey";
            columns: ["cancelled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_decided_by_fkey";
            columns: ["decided_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      departments: {
        Row: {
          created_at: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string;
          booking_id: string | null;
          created_at: string;
          id: string;
          is_read: boolean;
          title: string;
          user_id: string;
        };
        Insert: {
          body?: string;
          booking_id?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          title: string;
          user_id: string;
        };
        Update: {
          body?: string;
          booking_id?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          department_id: string | null;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          phone: string | null;
        };
        Insert: {
          created_at?: string;
          department_id?: string | null;
          email?: string;
          full_name?: string;
          id: string;
          is_active?: boolean;
          phone?: string | null;
        };
        Update: {
          created_at?: string;
          department_id?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          phone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      venues: {
        Row: {
          approver_id: string | null;
          capacity: number;
          close_time: string;
          created_at: string;
          description: string;
          equipment: string[];
          facilities: string[];
          id: string;
          location: string;
          maintenance_note: string | null;
          name: string;
          open_time: string;
          photos: string[];
          status: Database["public"]["Enums"]["venue_status"];
        };
        Insert: {
          approver_id?: string | null;
          capacity: number;
          close_time?: string;
          created_at?: string;
          description?: string;
          equipment?: string[];
          facilities?: string[];
          id?: string;
          location?: string;
          maintenance_note?: string | null;
          name: string;
          open_time?: string;
          photos?: string[];
          status?: Database["public"]["Enums"]["venue_status"];
        };
        Update: {
          approver_id?: string | null;
          capacity?: number;
          close_time?: string;
          created_at?: string;
          description?: string;
          equipment?: string[];
          facilities?: string[];
          id?: string;
          location?: string;
          maintenance_note?: string | null;
          name?: string;
          open_time?: string;
          photos?: string[];
          status?: Database["public"]["Enums"]["venue_status"];
        };
        Relationships: [
          {
            foreignKeyName: "venues_approver_id_fkey";
            columns: ["approver_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      approve_booking: { Args: { _booking: string }; Returns: undefined };
      booking_conflicts: {
        Args: { _end: string; _exclude: string; _start: string; _venue: string };
        Returns: boolean;
      };
      buffered_range: {
        Args: { _end: string; _start: string };
        Returns: unknown;
      };
      can_decide: { Args: { _booking: string }; Returns: boolean };
      cancel_booking: { Args: { _booking: string }; Returns: undefined };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: never; Returns: boolean };
      log_audit: {
        Args: {
          _action: string;
          _details: Json;
          _entity: string;
          _entity_id: string;
        };
        Returns: undefined;
      };
      reject_booking: {
        Args: { _booking: string; _reason: string };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "admin" | "approver" | "staff";
      booking_status: "pending" | "approved" | "rejected" | "cancelled";
      venue_status: "active" | "maintenance" | "inactive";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "approver", "staff"],
      booking_status: ["pending", "approved", "rejected", "cancelled"],
      venue_status: ["active", "maintenance", "inactive"],
    },
  },
} as const;
