export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      account_roles: {
        Row: {
          created_at: string;
          role: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          role: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      analyses: {
        Row: {
          data: Json;
          id: string;
          owner_id: string;
          updated_at: string;
        };
        Insert: {
          data: Json;
          id: string;
          owner_id: string;
          updated_at?: string;
        };
        Update: {
          data?: Json;
          id?: string;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "analyses_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "account_roles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      ideas: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          title: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string;
          id?: string;
          title: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      machines: {
        Row: {
          brand: string;
          category: string;
          id: string;
          manufacturer_id: string;
          materials: string[];
          max_x_mm: number | null;
          max_y_mm: number | null;
          max_z_mm: number | null;
          model: string;
          name: string;
          notes: string;
          processes: string[];
          special_capabilities: string[];
          tolerance_mm: number | null;
        };
        Insert: {
          brand?: string;
          category: string;
          id?: string;
          manufacturer_id: string;
          materials?: string[];
          max_x_mm?: number | null;
          max_y_mm?: number | null;
          max_z_mm?: number | null;
          model?: string;
          name: string;
          notes?: string;
          processes: string[];
          special_capabilities?: string[];
          tolerance_mm?: number | null;
        };
        Update: {
          brand?: string;
          category?: string;
          id?: string;
          manufacturer_id?: string;
          materials?: string[];
          max_x_mm?: number | null;
          max_y_mm?: number | null;
          max_z_mm?: number | null;
          model?: string;
          name?: string;
          notes?: string;
          processes?: string[];
          special_capabilities?: string[];
          tolerance_mm?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "machines_manufacturer_id_fkey";
            columns: ["manufacturer_id"];
            isOneToOne: false;
            referencedRelation: "manufacturer_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      manufacturer_profiles: {
        Row: {
          business_name: string;
          capacity_notes: string;
          contact_email: string;
          contact_phone: string;
          description: string;
          limitations: string;
          location: string;
          materials: string[];
          max_x_mm: number | null;
          max_y_mm: number | null;
          max_z_mm: number | null;
          processes: string[];
          published: boolean;
          tolerance_mm: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          business_name: string;
          capacity_notes?: string;
          contact_email: string;
          contact_phone?: string;
          description?: string;
          limitations?: string;
          location: string;
          materials?: string[];
          max_x_mm?: number | null;
          max_y_mm?: number | null;
          max_z_mm?: number | null;
          processes?: string[];
          published?: boolean;
          tolerance_mm?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          business_name?: string;
          capacity_notes?: string;
          contact_email?: string;
          contact_phone?: string;
          description?: string;
          limitations?: string;
          location?: string;
          materials?: string[];
          max_x_mm?: number | null;
          max_y_mm?: number | null;
          max_z_mm?: number | null;
          processes?: string[];
          published?: boolean;
          tolerance_mm?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "manufacturer_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "account_roles";
            referencedColumns: ["user_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      save_manufacturer_profile: {
        Args: { business: Json; equipment: Json };
        Returns: undefined;
      };
      verified_account_role: { Args: never; Returns: string };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
