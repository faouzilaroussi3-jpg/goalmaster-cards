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
      admin_grants: {
        Row: {
          card_copies: number
          card_id: string | null
          card_version: string | null
          coins: number
          created_at: string
          granted_by: string | null
          id: string
          note: string | null
          pack_type_id: string | null
          packs: number
          seen_at: string | null
          user_id: string
        }
        Insert: {
          card_copies?: number
          card_id?: string | null
          card_version?: string | null
          coins?: number
          created_at?: string
          granted_by?: string | null
          id?: string
          note?: string | null
          pack_type_id?: string | null
          packs?: number
          seen_at?: string | null
          user_id: string
        }
        Update: {
          card_copies?: number
          card_id?: string | null
          card_version?: string | null
          coins?: number
          created_at?: string
          granted_by?: string | null
          id?: string
          note?: string | null
          pack_type_id?: string | null
          packs?: number
          seen_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_grants_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_grants_pack_type_id_fkey"
            columns: ["pack_type_id"]
            isOneToOne: false
            referencedRelation: "pack_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_reads: {
        Row: {
          seen_at: string
          user_id: string
        }
        Insert: {
          seen_at?: string
          user_id: string
        }
        Update: {
          seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          body: string | null
          created_at: string
          id: string
          item_count: number
          items: Json
          kind: string
          ref: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          item_count?: number
          items?: Json
          kind: string
          ref?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          item_count?: number
          items?: Json
          kind?: string
          ref?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      big_pulls: {
        Row: {
          card_id: string
          club: string
          id: string
          image_url: string | null
          name: string
          nationality: string
          opening_id: string | null
          pack_key: string | null
          pos: string
          pulled_at: string
          rarity: string
          rating: number
          user_id: string
          version: string
        }
        Insert: {
          card_id: string
          club: string
          id?: string
          image_url?: string | null
          name: string
          nationality: string
          opening_id?: string | null
          pack_key?: string | null
          pos: string
          pulled_at?: string
          rarity: string
          rating: number
          user_id: string
          version?: string
        }
        Update: {
          card_id?: string
          club?: string
          id?: string
          image_url?: string | null
          name?: string
          nationality?: string
          opening_id?: string | null
          pack_key?: string | null
          pos?: string
          pulled_at?: string
          rarity?: string
          rating?: number
          user_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "big_pulls_opening_id_fkey"
            columns: ["opening_id"]
            isOneToOne: false
            referencedRelation: "pack_openings"
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
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_matches: {
        Row: {
          away_goals: number
          away_id: string | null
          away_report: Json | null
          away_reward: number | null
          away_seen_at: string | null
          away_team: Json | null
          bot_level: string | null
          created_at: string
          disputed: boolean
          finished_at: string | null
          forfeit_by: string | null
          home_goals: number
          home_id: string
          home_report: Json | null
          home_reward: number | null
          home_seen_at: string | null
          home_team: Json
          id: string
          mode: string
          result: string | null
          started_at: string | null
          status: string
          winner_id: string | null
        }
        Insert: {
          away_goals?: number
          away_id?: string | null
          away_report?: Json | null
          away_reward?: number | null
          away_seen_at?: string | null
          away_team?: Json | null
          bot_level?: string | null
          created_at?: string
          disputed?: boolean
          finished_at?: string | null
          forfeit_by?: string | null
          home_goals?: number
          home_id: string
          home_report?: Json | null
          home_reward?: number | null
          home_seen_at?: string | null
          home_team: Json
          id?: string
          mode: string
          result?: string | null
          started_at?: string | null
          status?: string
          winner_id?: string | null
        }
        Update: {
          away_goals?: number
          away_id?: string | null
          away_report?: Json | null
          away_reward?: number | null
          away_seen_at?: string | null
          away_team?: Json | null
          bot_level?: string | null
          created_at?: string
          disputed?: boolean
          finished_at?: string | null
          forfeit_by?: string | null
          home_goals?: number
          home_id?: string
          home_report?: Json | null
          home_reward?: number | null
          home_seen_at?: string | null
          home_team?: Json
          id?: string
          mode?: string
          result?: string | null
          started_at?: string | null
          status?: string
          winner_id?: string | null
        }
        Relationships: []
      }
      manager_teams: {
        Row: {
          bench: string[]
          formation: string
          starters: string[]
          tactic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bench?: string[]
          formation: string
          starters: string[]
          tactic?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bench?: string[]
          formation?: string
          starters?: string[]
          tactic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      match_halftime: {
        Row: {
          created_at: string
          match_id: string
          player_id: string
          subs: Json
          team: Json
        }
        Insert: {
          created_at?: string
          match_id: string
          player_id: string
          subs?: Json
          team: Json
        }
        Update: {
          created_at?: string
          match_id?: string
          player_id?: string
          subs?: Json
          team?: Json
        }
        Relationships: [
          {
            foreignKeyName: "match_halftime_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_stats: {
        Row: {
          draws: number
          goals_against: number
          goals_for: number
          losses: number
          played: number
          rating: number
          updated_at: string
          user_id: string
          wins: number
        }
        Insert: {
          draws?: number
          goals_against?: number
          goals_for?: number
          losses?: number
          played?: number
          rating?: number
          updated_at?: string
          user_id: string
          wins?: number
        }
        Update: {
          draws?: number
          goals_against?: number
          goals_for?: number
          losses?: number
          played?: number
          rating?: number
          updated_at?: string
          user_id?: string
          wins?: number
        }
        Relationships: []
      }
      matches: {
        Row: {
          away_elo_delta: number | null
          away_goals: number
          away_id: string | null
          away_reward: number | null
          away_team: Json | null
          away_team2: Json | null
          created_at: string
          finished_at: string | null
          first_half: Json | null
          halftime_at: string | null
          home_elo_delta: number | null
          home_goals: number
          home_id: string
          home_reward: number | null
          home_team: Json
          home_team2: Json | null
          id: string
          second_half: Json | null
          status: string
          winner_id: string | null
        }
        Insert: {
          away_elo_delta?: number | null
          away_goals?: number
          away_id?: string | null
          away_reward?: number | null
          away_team?: Json | null
          away_team2?: Json | null
          created_at?: string
          finished_at?: string | null
          first_half?: Json | null
          halftime_at?: string | null
          home_elo_delta?: number | null
          home_goals?: number
          home_id: string
          home_reward?: number | null
          home_team: Json
          home_team2?: Json | null
          id?: string
          second_half?: Json | null
          status?: string
          winner_id?: string | null
        }
        Update: {
          away_elo_delta?: number | null
          away_goals?: number
          away_id?: string | null
          away_reward?: number | null
          away_team?: Json | null
          away_team2?: Json | null
          created_at?: string
          finished_at?: string | null
          first_half?: Json | null
          halftime_at?: string | null
          home_elo_delta?: number | null
          home_goals?: number
          home_id?: string
          home_reward?: number | null
          home_team?: Json
          home_team2?: Json | null
          id?: string
          second_half?: Json | null
          status?: string
          winner_id?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          archived: boolean
          art: string
          bonus_rates: Json
          card_back: Json
          description: string | null
          effect: string
          id: string
          image_url: string | null
          initial_stock: number
          key: string
          max_stock: number
          name: string
          price_coins: number
          regen_minutes: number
          slot_count: number
          slot_rates: Json
          sort_order: number
          tint: string | null
          version_rates: Json
          xp_reward: number
        }
        Insert: {
          active?: boolean
          archived?: boolean
          art?: string
          bonus_rates: Json
          card_back?: Json
          description?: string | null
          effect?: string
          id?: string
          image_url?: string | null
          initial_stock?: number
          key: string
          max_stock?: number
          name: string
          price_coins?: number
          regen_minutes?: number
          slot_count?: number
          slot_rates: Json
          sort_order?: number
          tint?: string | null
          version_rates?: Json
          xp_reward?: number
        }
        Update: {
          active?: boolean
          archived?: boolean
          art?: string
          bonus_rates?: Json
          card_back?: Json
          description?: string | null
          effect?: string
          id?: string
          image_url?: string | null
          initial_stock?: number
          key?: string
          max_stock?: number
          name?: string
          price_coins?: number
          regen_minutes?: number
          slot_count?: number
          slot_rates?: Json
          sort_order?: number
          tint?: string | null
          version_rates?: Json
          xp_reward?: number
        }
        Relationships: []
      }
      periodic_challenge_claims: {
        Row: {
          challenge_id: string
          claimed_at: string
          id: string
          period_start: string
          reward_coins: number
          reward_pack_key: string | null
          reward_packs: number
          user_id: string
        }
        Insert: {
          challenge_id: string
          claimed_at?: string
          id?: string
          period_start: string
          reward_coins?: number
          reward_pack_key?: string | null
          reward_packs?: number
          user_id: string
        }
        Update: {
          challenge_id?: string
          claimed_at?: string
          id?: string
          period_start?: string
          reward_coins?: number
          reward_pack_key?: string | null
          reward_packs?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "periodic_challenge_claims_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "periodic_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      periodic_challenges: {
        Row: {
          active: boolean
          created_at: string
          ends_at: string | null
          id: string
          key: string
          metric: string
          period: string
          rarity: string | null
          reward_coins: number
          reward_pack_key: string | null
          reward_packs: number
          slot: number
          starts_at: string | null
          target: number
          title: string
          version: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          ends_at?: string | null
          id?: string
          key: string
          metric: string
          period: string
          rarity?: string | null
          reward_coins?: number
          reward_pack_key?: string | null
          reward_packs?: number
          slot?: number
          starts_at?: string | null
          target: number
          title: string
          version?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          ends_at?: string | null
          id?: string
          key?: string
          metric?: string
          period?: string
          rarity?: string | null
          reward_coins?: number
          reward_pack_key?: string | null
          reward_packs?: number
          slot?: number
          starts_at?: string | null
          target?: number
          title?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "periodic_challenges_rarity_fkey"
            columns: ["rarity"]
            isOneToOne: false
            referencedRelation: "rarities"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "periodic_challenges_reward_pack_key_fkey"
            columns: ["reward_pack_key"]
            isOneToOne: false
            referencedRelation: "pack_types"
            referencedColumns: ["key"]
          },
        ]
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
          active: boolean
          builtin: boolean
          color: string | null
          created_at: string
          duplicate_coins: number
          effect: string
          extra_effects: string[]
          key: string
          label: string
          rank: number
          shape: string
          short_label: string
          tier: number
        }
        Insert: {
          active?: boolean
          builtin?: boolean
          color?: string | null
          created_at?: string
          duplicate_coins?: number
          effect?: string
          extra_effects?: string[]
          key: string
          label: string
          rank?: number
          shape?: string
          short_label: string
          tier: number
        }
        Update: {
          active?: boolean
          builtin?: boolean
          color?: string | null
          created_at?: string
          duplicate_coins?: number
          effect?: string
          extra_effects?: string[]
          key?: string
          label?: string
          rank?: number
          shape?: string
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
      _claim_periodic: { Args: { _cid: string; _uid: string }; Returns: Json }
      _current_periodic_challenges: {
        Args: never
        Returns: {
          challenge_id: string
          period: string
          period_end: string
          period_start: string
        }[]
      }
      _draw_card: { Args: { _exclude: string[]; _w: Json }; Returns: string }
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
      _effect_base: { Args: { _effect: string }; Returns: string }
      _finish_duel: {
        Args: { _forfeit: boolean; _id: string; _winner: string }
        Returns: undefined
      }
      _is_big_pull: { Args: { _rarity: string }; Returns: boolean }
      _lm_bot_team: { Args: { _level: string }; Returns: Json }
      _lm_finish: {
        Args: {
          _ag: number
          _disputed?: boolean
          _forfeit: string
          _hg: number
          _id: string
        }
        Returns: undefined
      }
      _mm_cards: { Args: { _ids: string[]; _uid: string }; Returns: Json }
      _mm_fit: { Args: { _pos: string; _role: string }; Returns: number }
      _mm_formation: { Args: { _f: string }; Returns: string[] }
      _mm_lines: { Args: { _f: string }; Returns: string[] }
      _mm_payout: { Args: { _score: number }; Returns: number }
      _mm_rarity_bonus: {
        Args: { _rarity: string; _version: string }
        Returns: number
      }
      _mm_rate: {
        Args: { _bench: Json; _formation: string; _tactic: string; _xi: Json }
        Returns: Json
      }
      _mm_reward_ok: { Args: { _uid: string }; Returns: boolean }
      _mm_second_half: { Args: { _id: string }; Returns: undefined }
      _mm_sim_half: { Args: { _a: Json; _h: Json }; Returns: Json }
      _mm_snapshot: { Args: { _uid: string }; Returns: Json }
      _period_bounds: {
        Args: { _period: string }
        Returns: Record<string, unknown>
      }
      _periodic_progress: {
        Args: {
          _from: string
          _metric: string
          _rarity: string
          _to: string
          _uid: string
          _version: string
        }
        Returns: number
      }
      _pick_card: {
        Args: { _exclude?: string[]; _rarity: string }
        Returns: string
      }
      _rarity_fx: { Args: { _key: string }; Returns: string }
      _settle_auctions: { Args: never; Returns: undefined }
      _settle_duels: { Args: never; Returns: undefined }
      _settle_live_matches: { Args: never; Returns: undefined }
      _settle_matches: { Args: never; Returns: undefined }
      _sync_stock: { Args: { _pt: string; _uid: string }; Returns: undefined }
      accept_duel: {
        Args: { _duel_id: string; _user_card_ids: string[] }
        Returns: string
      }
      accept_live_match: { Args: { _match_id: string }; Returns: string }
      accept_match: { Args: { _match_id: string }; Returns: string }
      admin_card_stats: {
        Args: never
        Returns: {
          card_id: string
          copies: number
          owners: number
        }[]
      }
      admin_create_rarity: {
        Args: {
          _after_key: string
          _color: string
          _duplicate_coins: number
          _effect: string
          _extra_effects?: string[]
          _label: string
          _short: string
        }
        Returns: string
      }
      admin_create_special_challenge: {
        Args: {
          _metric: string
          _minutes: number
          _rarity: string
          _reward_coins: number
          _reward_pack_key: string
          _reward_packs: number
          _target: number
          _title: string
          _version: string
        }
        Returns: string
      }
      admin_delete_pack: { Args: { _pack_id: string }; Returns: string }
      admin_delete_rarity: {
        Args: { _key: string; _move_to: string }
        Returns: number
      }
      admin_end_special_challenge: {
        Args: { _challenge_id: string }
        Returns: undefined
      }
      admin_grant: {
        Args: {
          _all: boolean
          _card_id: string
          _coins: number
          _copies: number
          _note: string
          _pack_key: string
          _packs: number
          _user_id: string
          _version: string
        }
        Returns: number
      }
      admin_list_players: {
        Args: { _q?: string }
        Returns: {
          coins: number
          is_admin: boolean
          level: number
          total_packs: number
          user_id: string
          username: string
        }[]
      }
      admin_replace_card: {
        Args: { _from: string; _to: string }
        Returns: number
      }
      admin_set_rarity_active: {
        Args: { _active: boolean; _key: string }
        Returns: undefined
      }
      admin_set_rarity_shape: {
        Args: { _key: string; _shape: string }
        Returns: undefined
      }
      admin_update_rarity: {
        Args: {
          _color: string
          _duplicate_coins: number
          _effect: string
          _extra_effects?: string[]
          _key: string
          _label: string
          _short: string
        }
        Returns: undefined
      }
      auction_min_bid: {
        Args: { _current: number; _start: number }
        Returns: number
      }
      auction_payout: { Args: { _amount: number }; Returns: number }
      buy_pack: { Args: { _pack_key: string }; Returns: undefined }
      cancel_auction: { Args: { _auction_id: string }; Returns: undefined }
      claim_all_challenges: { Args: never; Returns: Json }
      claim_all_periodic_challenges: { Args: never; Returns: Json }
      claim_challenge: { Args: { _challenge_id: string }; Returns: number }
      claim_gift_notices: {
        Args: never
        Returns: {
          card_copies: number
          card_name: string
          card_version: string
          coins: number
          created_at: string
          grant_id: string
          note: string
          pack_name: string
          packs: number
        }[]
      }
      claim_live_forfeit: { Args: { _match_id: string }; Returns: undefined }
      claim_periodic_challenge: {
        Args: { _challenge_id: string }
        Returns: Json
      }
      create_auction: {
        Args: { _hours: number; _start_price: number; _user_card_id: string }
        Returns: string
      }
      create_duel: {
        Args: { _opponent: string; _user_card_ids: string[] }
        Returns: string
      }
      create_live_match: { Args: { _opponent: string }; Returns: string }
      create_match: { Args: { _opponent: string }; Returns: string }
      get_auction_bids: {
        Args: { _auction_id: string }
        Returns: {
          amount: number
          bid_id: string
          created_at: string
          is_me: boolean
          username: string
        }[]
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
      get_big_pulls: {
        Args: { _limit?: number }
        Returns: {
          card_id: string
          club: string
          id: string
          image_url: string
          name: string
          nationality: string
          pack_key: string
          pack_name: string
          pos: string
          pulled_at: string
          rarity: string
          rating: number
          username: string
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
      get_friends: {
        Args: never
        Returns: {
          created_at: string
          friendship_id: string
          incoming: boolean
          last_at: string
          last_from_me: boolean
          last_message: string
          level: number
          status: string
          unread: number
          user_id: string
          username: string
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
      get_live_match: { Args: { _match_id: string }; Returns: Json }
      get_match: { Args: { _match_id: string }; Returns: Json }
      get_match_leaderboard: {
        Args: { _limit?: number }
        Returns: {
          draws: number
          goals_against: number
          goals_for: number
          level: number
          losses: number
          played: number
          rating: number
          user_id: string
          username: string
          wins: number
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
      get_my_live_matches: {
        Args: never
        Returns: {
          bot_level: string
          created_at: string
          finished_at: string
          incoming: boolean
          is_home: boolean
          match_id: string
          mode: string
          my_goals: number
          my_reward: number
          opponent_name: string
          result: string
          status: string
          their_goals: number
        }[]
      }
      get_my_matches: {
        Args: never
        Returns: {
          created_at: string
          finished_at: string
          halftime_at: string
          incoming: boolean
          is_home: boolean
          match_id: string
          my_elo_delta: number
          my_general: number
          my_goals: number
          my_reward: number
          needs_me: boolean
          open_invite: boolean
          opponent_id: string
          opponent_name: string
          result: string
          status: string
          their_general: number
          their_goals: number
          they_ready: boolean
        }[]
      }
      get_my_packs: {
        Args: never
        Returns: {
          art: string
          card_back: Json
          count: number
          description: string
          effect: string
          image_url: string
          max_stock: number
          name: string
          next_at: string
          pack_key: string
          price_coins: number
          regen_minutes: number
          slot_count: number
          tint: string
        }[]
      }
      get_my_periodic_challenges: {
        Args: never
        Returns: {
          challenge_id: string
          claimed: boolean
          ends_at: string
          key: string
          metric: string
          period: string
          progress: number
          rarity: string
          reward_coins: number
          reward_pack_key: string
          reward_pack_name: string
          reward_packs: number
          target: number
          title: string
          version: string
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
      get_open_matches: {
        Args: never
        Returns: {
          created_at: string
          formation: string
          home_general: number
          home_id: string
          home_name: string
          home_rating: number
          match_id: string
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
      leave_live_match: { Args: { _match_id: string }; Returns: undefined }
      leave_match: { Args: { _match_id: string }; Returns: undefined }
      live_ping: { Args: { _match_id: string }; Returns: string }
      mark_messages_read: { Args: { _from: string }; Returns: undefined }
      mark_news_seen: { Args: never; Returns: string }
      open_pack: { Args: { _pack_key: string }; Returns: Json }
      place_bid: {
        Args: { _amount: number; _auction_id: string }
        Returns: undefined
      }
      play_card: { Args: { _duel_id: string; _slot: number }; Returns: Json }
      remove_friend: { Args: { _friendship_id: string }; Returns: undefined }
      report_live_result: {
        Args: { _away: number; _home: number; _match_id: string }
        Returns: undefined
      }
      respond_friend_request: {
        Args: { _accept: boolean; _friendship_id: string }
        Returns: undefined
      }
      save_manager_team: {
        Args: {
          _bench: string[]
          _formation: string
          _starters: string[]
          _tactic: string
        }
        Returns: Json
      }
      search_players: {
        Args: { _q: string }
        Returns: {
          level: number
          relation: string
          user_id: string
          username: string
        }[]
      }
      send_friend_request: { Args: { _to: string }; Returns: string }
      send_message: { Args: { _body: string; _to: string }; Returns: string }
      start_bot_match: { Args: { _level: string }; Returns: string }
      submit_halftime: {
        Args: { _match_id: string; _subs: Json; _tactic: string }
        Returns: undefined
      }
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
