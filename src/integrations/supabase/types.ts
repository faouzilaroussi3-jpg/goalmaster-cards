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
      cards: {
        Row: {
          active: boolean
          club: string
          created_at: string
          has_alt: boolean
          has_shiny: boolean
          id: string
          image_url: string | null
          name: string
          nationality: string
          photo_author: string | null
          photo_license: string | null
          photo_license_url: string | null
          photo_source: string | null
          pos: string
          rarity: string
          rating: number
          revealed: boolean
        }
        Insert: {
          active?: boolean
          club: string
          created_at?: string
          has_alt?: boolean
          has_shiny?: boolean
          id?: string
          image_url?: string | null
          name: string
          nationality: string
          photo_author?: string | null
          photo_license?: string | null
          photo_license_url?: string | null
          photo_source?: string | null
          pos: string
          rarity: string
          rating: number
          revealed?: boolean
        }
        Update: {
          active?: boolean
          club?: string
          created_at?: string
          has_alt?: boolean
          has_shiny?: boolean
          id?: string
          image_url?: string | null
          name?: string
          nationality?: string
          photo_author?: string | null
          photo_license?: string | null
          photo_license_url?: string | null
          photo_source?: string | null
          pos?: string
          rarity?: string
          rating?: number
          revealed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "cards_rarity_fkey"
            columns: ["rarity"]
            isOneToOne: false
            referencedRelation: "rarities"
            referencedColumns: ["key"]
          },
        ]
      }
      events: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          pack_key: string | null
          starts_at: string
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          pack_key?: string | null
          starts_at?: string
          title: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          pack_key?: string | null
          starts_at?: string
          title?: string
        }
        Relationships: []
      }
      pack_openings: {
        Row: {
          created_at: string
          id: string
          pack_type_id: string
          results: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pack_type_id: string
          results?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pack_type_id?: string
          results?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_openings_pack_type_id_fkey"
            columns: ["pack_type_id"]
            isOneToOne: false
            referencedRelation: "pack_types"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_stocks: {
        Row: {
          count: number
          id: string
          last_regen_at: string
          pack_type_id: string
          user_id: string
        }
        Insert: {
          count?: number
          id?: string
          last_regen_at?: string
          pack_type_id: string
          user_id: string
        }
        Update: {
          count?: number
          id?: string
          last_regen_at?: string
          pack_type_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_stocks_pack_type_id_fkey"
            columns: ["pack_type_id"]
            isOneToOne: false
            referencedRelation: "pack_types"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_types: {
        Row: {
          active: boolean
          bonus_rates: Json
          description: string | null
          id: string
          initial_stock: number
          key: string
          max_stock: number
          name: string
          price_coins: number
          regen_minutes: number
          slot_count: number
          slot_rates: Json
          sort_order: number
          xp_reward: number
        }
        Insert: {
          active?: boolean
          bonus_rates: Json
          description?: string | null
          id?: string
          initial_stock?: number
          key: string
          max_stock?: number
          name: string
          price_coins?: number
          regen_minutes?: number
          slot_count?: number
          slot_rates: Json
          sort_order?: number
          xp_reward?: number
        }
        Update: {
          active?: boolean
          bonus_rates?: Json
          description?: string | null
          id?: string
          initial_stock?: number
          key?: string
          max_stock?: number
          name?: string
          price_coins?: number
          regen_minutes?: number
          slot_count?: number
          slot_rates?: Json
          sort_order?: number
          xp_reward?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          coins: number
          created_at: string
          id: string
          level: number
          username: string
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          coins?: number
          created_at?: string
          id: string
          level?: number
          username: string
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          coins?: number
          created_at?: string
          id?: string
          level?: number
          username?: string
          xp?: number
        }
        Relationships: []
      }
      rarities: {
        Row: {
          duplicate_coins: number
          key: string
          label: string
          short_label: string
          tier: number
        }
        Insert: {
          duplicate_coins?: number
          key: string
          label: string
          short_label: string
          tier: number
        }
        Update: {
          duplicate_coins?: number
          key?: string
          label?: string
          short_label?: string
          tier?: number
        }
        Relationships: []
      }
      user_cards: {
        Row: {
          card_id: string
          id: string
          obtained_at: string
          opening_id: string | null
          user_id: string
          version: string
        }
        Insert: {
          card_id: string
          id?: string
          obtained_at?: string
          opening_id?: string | null
          user_id: string
          version?: string
        }
        Update: {
          card_id?: string
          id?: string
          obtained_at?: string
          opening_id?: string | null
          user_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_cards_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_cards_opening_id_fkey"
            columns: ["opening_id"]
            isOneToOne: false
            referencedRelation: "pack_openings"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _draw_key: { Args: { _w: Json }; Returns: string }
      _pick_card: {
        Args: { _exclude?: string[]; _rarity: string }
        Returns: string
      }
      _sync_stock: { Args: { _pt: string; _uid: string }; Returns: undefined }
      buy_pack: { Args: { _pack_key: string }; Returns: undefined }
      get_leaderboard: {
        Args: { _limit?: number; _sort?: string }
        Returns: {
          legendaries: number
          level: number
          shinies: number
          total: number
          ultimates: number
          unique_cards: number
          user_id: string
          username: string
        }[]
      }
      get_my_packs: {
        Args: never
        Returns: {
          count: number
          description: string
          max_stock: number
          name: string
          next_at: string
          pack_key: string
          price_coins: number
          regen_minutes: number
        }[]
      }
      get_recent_drops: {
        Args: { _limit?: number }
        Returns: {
          club: string
          image_url: string
          name: string
          nationality: string
          obtained_at: string
          pos: string
          rarity: string
          rating: number
          username: string
          version: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      open_pack: { Args: { _pack_key: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
