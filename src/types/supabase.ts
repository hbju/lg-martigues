export type PlayerRole = 'villager' | 'werewolf'
export type PlayerStatus = 'pending' | 'alive' | 'ghost'
export type GamePhase = 'setup' | 'role_reveal' | 'playing' | 'final_vote' | 'finished'

export interface Player {
  id: string
  name: string
  auth_token: string
  role: PlayerRole | null
  status: PlayerStatus
  team_id: string | null
  shields: number
  clairvoyance_count: number
  is_gm: boolean
  created_at: string
}

export interface GameState {
  id: number
  phase: GamePhase
  current_round: number
  is_final_vote: boolean
  werewolf_count: number
  villager_count: number
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      players: {
        Row: Player
        Insert: {
          id?: string
          name: string
          auth_token: string
          role?: PlayerRole | null
          status?: PlayerStatus
          team_id?: string | null
          shields?: number
          clairvoyance_count?: number
          is_gm?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          auth_token?: string
          role?: PlayerRole | null
          status?: PlayerStatus
          team_id?: string | null
          shields?: number
          clairvoyance_count?: number
          is_gm?: boolean
          created_at?: string
        }
        Relationships: []
      }
      game_state: {
        Row: GameState
        Insert: {
          id?: number
          phase?: GamePhase
          current_round?: number
          is_final_vote?: boolean
          werewolf_count?: number
          villager_count?: number
          metadata?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          phase?: GamePhase
          current_round?: number
          is_final_vote?: boolean
          werewolf_count?: number
          villager_count?: number
          metadata?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      player_role: PlayerRole
      player_status: PlayerStatus
      game_phase: GamePhase
    }
  }
}
