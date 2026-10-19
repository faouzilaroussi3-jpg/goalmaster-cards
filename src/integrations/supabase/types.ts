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
      auction_bids: {
        Row: {
          amount: number
          auction_id: string
          bidder_id: string
          created_at: string
          id: string
        }
        Insert: {
          amount: number
          auction_id: string
          bidder_id: string
          created_at?: string
          id?: string
        }
        Update: {
          amount?: number
          auction_id?: string
          bidder_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      auctions: {
        Row: {
          bid_count: number
          card_id: string
          created_at: string
          current_bid: number | null
          current_bidder: string | null
          ends_at: string
          id: string
          seller_id: string
          seller_received: number | null
          settled_at: string | null
          start_price: number
          status: string
          user_card_id: string
          version: string
        }
        Insert: {
          bid_count?: number
          card_id: string
          created_at?: string
          current_bid?: number | null
          current_bidder?: string | null
          ends_at: string
          id?: string
          seller_id: string
          seller_received?: number | null
          settled_at?: string | null
          start_price: number
          status?: string
          user_card_id: string
          version?: string
        }
        Update: {
          bid_count?: number
          card_id?: string
          created_at?: string
          current_bid?: number | null
          current_bidder?: string | null
          ends_at?: string
          id?: string
          seller_id?: string
          seller_received?: number | null
          settled_at?: string | null
          start_price?: number
          status?: string
          user_card_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "auctions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auctions_user_card_id_fkey"
            columns: ["user_card_id"]
            isOneToOne: false
            referencedRelation: "user_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          active: boolean
          alt_image_url: string | null
          alt_photo_author: string | null
          alt_photo_license: string | null
          alt_photo_license_url: string | null
          alt_photo_source: string | null
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
          alt_image_url?: string | null
          alt_photo_author?: string | null
          alt_photo_license?: string | null
          alt_photo_license_url?: string | null
          alt_photo_source?: string | null
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
          alt_image_url?: string | null
          alt_photo_author?: string | null
          alt_photo_license?: string | null
          alt_photo_license_url?: string | null
          alt_photo_source?: string | null
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
      challenge_claims: {
        Row: {
          challenge_id: string
          claimed_at: string
          id: string
          reward_coins: number
          user_id: string
        }
        Insert: {
          challenge_id: string
          claimed_at?: string
          id?: string
          reward_coins: number
          user_id: string
        }
        Update: {
          challenge_id?: string
          claimed_at?: string
          id?: string
          reward_coins?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_claims_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          active: boolean
          created_at: string
          id: string
          key: string
          metric: string
          rarity: string | null
          reward_coins: number
          secret: boolean
          sort_order: number
          target: number
          title: string
          version: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          key: string
          metric?: string
          rarity?: string | null
          reward_coins: number
          secret?: boolean
          sort_order?: number
          target: number
          title: string
          version?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          key?: string
          metric?: string
          rarity?: string | null
          reward_coins?: number
          secret?: boolean
          sort_order?: number
          target?: number
          title?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenges_rarity_fkey"
            columns: ["rarity"]
            isOneToOne: false
            referencedRelation: "rarities"
            referencedColumns: ["key"]
          },
        ]
      }
      duel_decks: {
        Row: {
          cards: Json
          duel_id: string
          player_id: string
        }
        Insert: {
          cards: Json
          duel_id: string
          player_id: string
        }
        Update: {
          cards?: Json
          duel_id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duel_decks_duel_id_fkey"
            columns: ["duel_id"]
            isOneToOne: false
            referencedRelation: "duels"
            referencedColumns: ["id"]
          },
        ]
      }
      duel_moves: {
        Row: {
          created_at: string
          duel_id: string
          player_id: string
          round: number
          slot: number
        }
        Insert: {
          created_at?: string
          duel_id: string
          player_id: string
          round: number
          slot: number
        }
        Update: {
          created_at?: string
          duel_id?: string
          player_id?: string
          round?: number
          slot?: number
        }
        Relationships: [
          {
            foreignKeyName: "duel_moves_duel_id_fkey"
            columns: ["duel_id"]
            isOneToOne: false
            referencedRelation: "duels"
            referencedColumns: ["id"]
          },
        ]
      }
      duel_stats: {
        Row: {
          draws: number
          losses: number
          played: number
          rating: number
          updated_at: string
          user_id: string
          wins: number
        }
        Insert: {
          draws?: number
          losses?: number
          played?: number
          rating?: number
          updated_at?: string
          user_id: string
          wins?: number
        }
        Update: {
          draws?: number
          losses?: number
          played?: number
          rating?: number
          updated_at?: string
          user_id?: string
          wins?: number
        }
        Relationships: []
      }
      duels: {
        Row: {
          challenger_elo_delta: number | null
          challenger_id: string
          challenger_played: boolean
          challenger_reward: number | null
          challenger_score: number
          created_at: string
          finished_at: string | null
          forfeit: boolean
          id: string
          opponent_elo_delta: number | null
          opponent_id: string | null
          opponent_played: boolean
          opponent_reward: number | null
          opponent_score: number
          round: number
          round_started_at: string | null
          rounds: Json
          status: string
          themes: string[]
          winner_id: string | null
        }
        Insert: {
          challenger_elo_delta?: number | null
          challenger_id: string
          challenger_played?: boolean
          challenger_reward?: number | null
          challenger_score?: number
          created_at?: string
          finished_at?: string | null
          forfeit?: boolean
          id?: string
          opponent_elo_delta?: number | null
          opponent_id?: string | null
          opponent_played?: boolean
          opponent_reward?: number | null
          opponent_score?: number
          round?: number
          round_started_at?: string | null
          rounds?: Json
          status?: string
          themes: string[]
          winner_id?: string | null
        }
        Update: {
          challenger_elo_delta?: number | null
          challenger_id?: string
          challenger_played?: boolean
          challenger_reward?: number | null
          challenger_score?: number
          created_at?: string
          finished_at?: string | null
          forfeit?: boolean
          id?: string
          opponent_elo_delta?: number | null
          opponent_id?: string | null
          opponent_played?: boolean
          opponent_reward?: number | null
          opponent_score?: number
          round?: number
          round_started_at?: string | null
          rounds?: Json
          status?: string
          themes?: string[]
          winner_id?: string | null
        }
        Relationships: []
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
          version_rates: Json
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
          version_rates?: Json
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
          version_rates?: Json
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
      _challenge_progress: {
        Args: {
          _metric: string
          _rarity: string
          _uid: string
          _version: string
        }
        Returns: number
      }
      _claim_challenge: {
        Args: { _cid: string; _uid: string }
        Returns: number
      }
      _draw_key: { Args: { _w: Json }; Returns: string }
      _duel_cost: { Args: { _rarity: string }; Returns: number }
      _duel_deck: { Args: { _ids: string[]; _uid: string }; Returns: Json }
      _duel_payout: {
        Args: { _forfeit: boolean; _score: number }
        Returns: number
      }
      _duel_power: {
        Args: {
          _pos: string
          _rarity: string
          _rating: number
          _theme: string
          _version: string
        }
        Returns: number
      }
      _duel_reward_ok: { Args: { _uid: string }; Returns: boolean }
      _finish_duel: {
        Args: { _forfeit: boolean; _id: string; _winner: string }
        Returns: undefined
      }
      _pick_card: {
        Args: { _exclude?: string[]; _rarity: string }
        Returns: string
      }
      _settle_auctions: { Args: never; Returns: undefined }
      _settle_duels: { Args: never; Returns: undefined }
      _sync_stock: { Args: { _pt: string; _uid: string }; Returns: undefined }
      accept_duel: {
        Args: { _duel_id: string; _user_card_ids: string[] }
        Returns: string
      }
      admin_card_stats: {
        Args: never
        Returns: {
          card_id: string
          copies: number
          owners: number
        }[]
      }
      admin_replace_card: {
        Args: { _from: string; _to: string }
        Returns: number
      }
      auction_min_bid: {
        Args: { _current: number; _start: number }
        Returns: number
      }
      auction_payout: { Args: { _amount: number }; Returns: number }
      buy_pack: { Args: { _pack_key: string }; Returns: undefined }
      cancel_auction: { Args: { _auction_id: string }; Returns: undefined }
      claim_all_challenges: { Args: never; Returns: Json }
      claim_challenge: { Args: { _challenge_id: string }; Returns: number }
      create_auction: {
        Args: { _hours: number; _start_price: number; _user_card_id: string }
        Returns: string
      }
      create_duel: {
        Args: { _opponent: string; _user_card_ids: string[] }
        Returns: string
      }
      get_auctions: {
        Args: { _scope?: string }
        Returns: {
          auction_id: string
          bid_count: number
          bidder_name: string
          card_id: string
          club: string
          created_at: string
          current_bid: number
          ends_at: string
          i_bid: boolean
          i_lead: boolean
          image_url: string
          is_mine: boolean
          min_bid: number
          name: string
          nationality: string
          pos: string
          rarity: string
          rating: number
          seller_name: string
          seller_received: number
          start_price: number
          status: string
          tier: number
          version: string
        }[]
      }
      get_duel: { Args: { _duel_id: string }; Returns: Json }
      get_duel_leaderboard: {
        Args: { _limit?: number }
        Returns: {
          draws: number
          level: number
          losses: number
          played: number
          rating: number
          user_id: string
          username: string
          wins: number
        }[]
      }
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
      get_my_challenges: {
        Args: never
        Returns: {
          challenge_id: string
          claimed: boolean
          key: string
          metric: string
          progress: number
          rarity: string
          reward_coins: number
          secret: boolean
          sort_order: number
          target: number
          title: string
          version: string
        }[]
      }
      get_my_duels: {
        Args: never
        Returns: {
          created_at: string
          duel_id: string
          finished_at: string
          forfeit: boolean
          incoming: boolean
          is_challenger: boolean
          my_elo_delta: number
          my_reward: number
          my_score: number
          my_turn: boolean
          open_invite: boolean
          opponent_id: string
          opponent_name: string
          result: string
          round: number
          round_started_at: string
          status: string
          their_score: number
          they_played: boolean
        }[]
      }
      get_my_listed_copies: {
        Args: never
        Returns: {
          user_card_id: string
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
      get_open_duels: {
        Args: never
        Returns: {
          challenger_id: string
          challenger_name: string
          challenger_rating: number
          created_at: string
          duel_id: string
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
      leave_duel: { Args: { _duel_id: string }; Returns: undefined }
      open_pack: { Args: { _pack_key: string }; Returns: Json }
      place_bid: {
        Args: { _amount: number; _auction_id: string }
        Returns: undefined
      }
      play_card: { Args: { _duel_id: string; _slot: number }; Returns: Json }
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
