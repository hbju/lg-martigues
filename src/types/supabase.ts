export type PlayerRole = 'villager' | 'werewolf'
export type PlayerStatus = 'pending' | 'alive' | 'ghost'
export type GamePhase = 'setup' | 'role_reveal' | 'playing' | 'final_vote' | 'finished'
export type VoteRoundType = 'council' | 'murder' | 'final'
export type VoteRoundStatus = 'open' | 'closed' | 'resolved'
export type EliminationMethod = 'voted' | 'murdered' | 'random' | 'final_vote'
export type NotificationType =
  | 'role_assigned' | 'vote_open' | 'vote_result' | 'eliminated'
  | 'murder_window' | 'murder_result' | 'infected' | 'shield_gained'
  | 'clairvoyance_gained' | 'clairvoyance_result' | 'generic'

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

export interface VoteRound {
  id: string
  type: VoteRoundType
  status: VoteRoundStatus
  timer_duration_seconds: number
  timer_started_at: string | null
  timer_end_at: string | null
  created_by: string | null
  resolved_at: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface Vote {
  id: string
  round_id: string
  voter_id: string
  target_id: string
  is_random: boolean
  created_at: string
}

export interface Elimination {
  id: string
  player_id: string
  round_id: string | null
  method: EliminationMethod
  confirmed_by_gm: boolean
  created_at: string
}

export interface Notification {
  id: string
  player_id: string
  type: NotificationType
  title: string
  message: string
  read: boolean
  metadata: Record<string, unknown>
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      players: {
        Row: Player
        Insert: Partial<Player> & { name: string; auth_token: string }
        Update: Partial<Player>
        Relationships: []
      }
      game_state: {
        Row: GameState
        Insert: Partial<GameState>
        Update: Partial<GameState>
        Relationships: []
      }
      vote_rounds: {
        Row: VoteRound
        Insert: Partial<VoteRound> & { type: VoteRoundType }
        Update: Partial<VoteRound>
        Relationships: []
      }
      votes: {
        Row: Vote
        Insert: Partial<Vote> & { round_id: string; voter_id: string; target_id: string }
        Update: Partial<Vote>
        Relationships: []
      }
      eliminations: {
        Row: Elimination
        Insert: Partial<Elimination> & { player_id: string; method: EliminationMethod }
        Update: Partial<Elimination>
        Relationships: []
      }
      notifications: {
        Row: Notification
        Insert: Partial<Notification> & { player_id: string; type: NotificationType; title: string; message: string }
        Update: Partial<Notification>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      player_role: PlayerRole
      player_status: PlayerStatus
      game_phase: GamePhase
      vote_round_type: VoteRoundType
      vote_round_status: VoteRoundStatus
      elimination_method: EliminationMethod
      notification_type: NotificationType
    }
  }
}
