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
  | 'qr_approved' | 'qr_rejected' | 'challenge_update' | 'power_up_used'
  | 'final_vote_start' | 'game_over' | 'continue_poll'

export type PowerUpType = 'shield' | 'clairvoyance'
export type PowerUpSource = 'qr' | 'challenge' | 'meme' | 'manual'
export type QrRewardType = 'shield' | 'clairvoyance'
export type ChallengeType = 'beer_pong' | 'pub_crawl' | 'mad_scientists'
export type ChallengeStatus = 'upcoming' | 'active' | 'completed'

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
  metadata: Record<string, unknown>
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

export interface PowerUp {
  id: string
  player_id: string
  type: PowerUpType
  source: PowerUpSource
  used: boolean
  used_at: string | null
  used_on: string | null
  granted_by_gm: boolean
  metadata: Record<string, unknown>
  created_at: string
}

export interface QrCode {
  id: string
  code: string
  label: string | null
  reward_type: QrRewardType
  scanned_by: string | null
  scanned_at: string | null
  confirmed_by_gm: boolean
  created_at: string
  // joined
  scanner_name?: string
}

export interface Challenge {
  id: string
  name: string
  type: ChallengeType
  status: ChallengeStatus
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ChallengeScore {
  id: string
  challenge_id: string
  player_id: string | null
  team_id: string | null
  round_number: number | null
  score: number
  metadata: Record<string, unknown>
  created_at: string
}

export interface Team {
  id: string
  name: string
  challenge_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface TeamMember {
  team_id: string
  player_id: string
}

export interface ErrorLog {
  id: string
  player_id: string | null
  error_message: string
  error_stack: string | null
  url: string | null
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
      power_ups: {
        Row: PowerUp
        Insert: Partial<PowerUp> & { player_id: string; type: PowerUpType; source: PowerUpSource }
        Update: Partial<PowerUp>
        Relationships: []
      }
      qr_codes: {
        Row: QrCode
        Insert: Partial<QrCode> & { code: string; reward_type: QrRewardType }
        Update: Partial<QrCode>
        Relationships: []
      }
      challenges: {
        Row: Challenge
        Insert: Partial<Challenge> & { name: string; type: ChallengeType }
        Update: Partial<Challenge>
        Relationships: []
      }
      challenge_scores: {
        Row: ChallengeScore
        Insert: Partial<ChallengeScore> & { challenge_id: string }
        Update: Partial<ChallengeScore>
        Relationships: []
      }
      teams: {
        Row: Team
        Insert: Partial<Team> & { id: string; name: string }
        Update: Partial<Team>
        Relationships: []
      }
      team_members: {
        Row: TeamMember
        Insert: TeamMember
        Update: Partial<TeamMember>
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
      power_up_type: PowerUpType
      power_up_source: PowerUpSource
      qr_reward_type: QrRewardType
      challenge_type: ChallengeType
      challenge_status: ChallengeStatus
    }
  }
}
