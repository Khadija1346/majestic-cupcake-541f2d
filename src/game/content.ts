import type { NftState, QuestState } from '@/lib/types'

/** Everything progression-related reads from one Metrics snapshot. */
export interface Metrics {
  level: number
  tutorialDone: boolean
  gamesPlayed: number
  wins: number
  classicWins: number
  gamesToday: number
  dailyModeToday: number
  bestDaysToday: number
  gamesWeek: number
  winsWeek: number
  bestScoreWeek: number
  gamesSeason: number
  harmattanWinsSeason: number
  bestHarmattanScore: number
  bestScore: number
  totalGarriMade: number
  districts: number
  secrets: number
  npcs: number
  achievements: number
  questsClaimed: number
  seasonQuestsClaimed: number
  /** From the server referral ledger (QUALIFIED or REWARDED, not under review). */
  qualifiedReferrals: number
  /** Wallet ownership proven by signature. */
  walletLinked: number
  /** Whole $GARRI held, read on-chain by the server at the last balance check. */
  garriHeld: number
  /** Community links opened from the Community Hub (x, telegram). */
  communityActions: number
  /** Current Season leaderboard rank (verified runs only). 0 = not ranked. */
  seasonRank: number
}

// ─── Districts ──────────────────────────────────────────────────────────────
export const DISTRICTS = [
  { id: 'plaza', name: 'Central Plaza', icon: '⛲' },
  { id: 'games', name: 'Game District', icon: '🎮' },
  { id: 'questboard', name: 'Quest Board', icon: '📜' },
  { id: 'arena', name: 'Arena', icon: '🏟️' },
  { id: 'citizenhub', name: 'Citizen Hub', icon: '🪪' },
  { id: 'house', name: 'Player House', icon: '🏠' },
  { id: 'gallery', name: 'NFT Gallery', icon: '🖼️' },
  { id: 'market', name: 'Market', icon: '🧺' },
  { id: 'bank', name: 'Bank', icon: '🏦' },
  { id: 'gardens', name: 'Gardens', icon: '🌴' },
  { id: 'community', name: 'Community Hub', icon: '🥁' },
] as const

// ─── Secrets ────────────────────────────────────────────────────────────────
export const SECRETS = [
  { id: 'calabash', name: 'Old Calabash', icon: '🏺', hint: 'Where the town ends in the south-west, the old women once hid their savings.' },
  { id: 'cowrie', name: 'Ancient Cowrie', icon: '🐚', hint: 'Money of the ancestors rests in the far north-east corner.' },
  { id: 'adire', name: 'Adire Scrap', icon: '🧵', hint: 'A dyer dropped indigo cloth beside the Arena walls.' },
  { id: 'okadakey', name: 'Lost Okada Key', icon: '🔑', hint: 'Emeka lost his key between the Bank road and the Gardens.' },
  { id: 'goldencup', name: 'Golden Garri Cup', icon: '🏆', hint: 'Behind the pond, past where Zainab tends the flowers.' },
] as const

// ─── Achievements ───────────────────────────────────────────────────────────
export interface AchievementDef {
  id: string
  name: string
  desc: string
  icon: string
  xp: number
  hidden?: boolean
  test: (m: Metrics) => boolean
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'welcome', name: 'New in Town', desc: 'Create your GARRI ID.', icon: '🪪', xp: 20, test: () => true },
  { id: 'tutorial', name: 'Found Your Feet', desc: 'Complete the town tutorial.', icon: '👣', xp: 40, test: (m) => m.tutorialDone },
  { id: 'firstrun', name: 'First Fry', desc: 'Play your first GARRI SURVIVAL run.', icon: '🍳', xp: 30, test: (m) => m.gamesPlayed >= 1 },
  { id: 'firstwin', name: 'Still Standing', desc: 'Survive a full run.', icon: '🛡️', xp: 80, test: (m) => m.wins >= 1 },
  { id: 'harmattan', name: 'Dust and Glory', desc: 'Win a Harmattan run.', icon: '🌪️', xp: 150, test: (m) => m.harmattanWinsSeason >= 1 },
  { id: 'score5k', name: 'Big Pot', desc: 'Score 5,000+ in one run.', icon: '🔥', xp: 120, test: (m) => m.bestScore >= 5000 },
  { id: 'garri100', name: 'Garri Factory', desc: 'Make 100 cups of garri across runs.', icon: '🥣', xp: 100, test: (m) => m.totalGarriMade >= 100 },
  { id: 'explorer', name: 'Know Every Street', desc: 'Visit all 11 districts.', icon: '🧭', xp: 100, test: (m) => m.districts >= DISTRICTS.length },
  { id: 'social', name: 'Everybody Knows You', desc: 'Talk to every townsperson.', icon: '🗣️', xp: 60, test: (m) => m.npcs >= 7 },
  { id: 'secret1', name: 'Curious Citizen', desc: '???', icon: '✨', xp: 50, hidden: true, test: (m) => m.secrets >= 1 },
  { id: 'secretall', name: 'Keeper of Secrets', desc: '???', icon: '🗝️', xp: 250, hidden: true, test: (m) => m.secrets >= SECRETS.length },
  { id: 'level5', name: 'Rising Citizen', desc: 'Reach level 5.', icon: '⭐', xp: 0, test: (m) => m.level >= 5 },
  { id: 'quests5', name: 'Board Regular', desc: 'Claim 5 quests.', icon: '📜', xp: 60, test: (m) => m.questsClaimed >= 5 },
  { id: 'wallet', name: 'Bank Account', desc: 'Link your own wallet at the GARRI Bank.', icon: '🏦', xp: 40, test: (m) => m.walletLinked >= 1 },
  { id: 'holder', name: 'Garri in the Pot', desc: 'Hold $GARRI in your linked wallet.', icon: '🪙', xp: 100, test: (m) => m.garriHeld >= 1 },
  { id: 'neighbour', name: 'Good Neighbour', desc: 'Have a referral qualify.', icon: '🏘️', xp: 80, test: (m) => m.qualifiedReferrals >= 1 },
]

// ─── Quests ─────────────────────────────────────────────────────────────────
export type QuestCategory = 'daily' | 'weekly' | 'seasonal' | 'community' | 'exploration' | 'game' | 'achievement'

export interface QuestDef {
  id: string
  category: QuestCategory
  title: string
  desc: string
  target: number
  minLevel: number
  period: 'daily' | 'weekly' | 'season' | 'once'
  reward: { xp: number; rep: number; rp: number }
  /** Objective can be met before claims open (e.g. community rewards at season end). */
  claimOpensAt?: string
  metric: (m: Metrics) => number
}

export const QUESTS: QuestDef[] = [
  { id: 'd-run', category: 'daily', title: 'Morning Market', desc: 'Play 1 GARRI SURVIVAL run today.', target: 1, minLevel: 1, period: 'daily', reward: { xp: 40, rep: 1, rp: 10 }, metric: (m) => m.gamesToday },
  { id: 'd-challenge', category: 'daily', title: 'Daily Challenge', desc: 'Play today’s seeded Daily Challenge run.', target: 1, minLevel: 1, period: 'daily', reward: { xp: 60, rep: 1, rp: 15 }, metric: (m) => m.dailyModeToday },
  { id: 'd-days', category: 'daily', title: 'Hold the Line', desc: 'Survive 5 days in a single run today.', target: 5, minLevel: 2, period: 'daily', reward: { xp: 50, rep: 1, rp: 10 }, metric: (m) => m.bestDaysToday },
  { id: 'w-runs', category: 'weekly', title: 'Busy Week', desc: 'Play 7 runs this week.', target: 7, minLevel: 1, period: 'weekly', reward: { xp: 200, rep: 3, rp: 50 }, metric: (m) => m.gamesWeek },
  { id: 'w-wins', category: 'weekly', title: 'Two for Two', desc: 'Win 2 runs this week.', target: 2, minLevel: 2, period: 'weekly', reward: { xp: 250, rep: 4, rp: 60 }, metric: (m) => m.winsWeek },
  { id: 'w-score', category: 'weekly', title: 'Big Score Week', desc: 'Score 3,000+ in a run this week.', target: 3000, minLevel: 3, period: 'weekly', reward: { xp: 300, rep: 4, rp: 80 }, metric: (m) => m.bestScoreWeek },
  { id: 's-harmattan', category: 'seasonal', title: 'Harmattan Survivor', desc: 'Win a Harmattan-mode run this season.', target: 1, minLevel: 3, period: 'season', reward: { xp: 500, rep: 8, rp: 150 }, metric: (m) => m.harmattanWinsSeason },
  { id: 's-grind', category: 'seasonal', title: 'Season Regular', desc: 'Play 30 runs this season.', target: 30, minLevel: 1, period: 'season', reward: { xp: 600, rep: 10, rp: 200 }, metric: (m) => m.gamesSeason },
  { id: 'c-harvest', category: 'community', title: 'Town Harvest', desc: 'Contribute 5 runs to the town’s seasonal harvest. Rewards open when the season closes.', target: 5, minLevel: 1, period: 'season', reward: { xp: 300, rep: 6, rp: 100 }, claimOpensAt: '2026-12-31T23:59:59Z', metric: (m) => m.gamesSeason },
  { id: 'c-neighbor', category: 'community', title: 'Bring a Neighbour', desc: 'Have 1 referral qualify (new Citizen finishes the tutorial, plays a game and reaches level 2).', target: 1, minLevel: 1, period: 'once', reward: { xp: 200, rep: 5, rp: 75 }, metric: (m) => m.qualifiedReferrals },
  { id: 'c-crier', category: 'community', title: 'Hear the Town Crier', desc: 'Open GARRI on X and Telegram from the Community Hub.', target: 2, minLevel: 1, period: 'once', reward: { xp: 40, rep: 1, rp: 10 }, metric: (m) => m.communityActions },
  { id: 'c-wallet', category: 'community', title: 'Open a Bank Account', desc: 'Connect your own wallet at the GARRI Bank and sign to link it to your GARRI ID.', target: 1, minLevel: 1, period: 'once', reward: { xp: 80, rep: 2, rp: 20 }, metric: (m) => m.walletLinked },
  { id: 'c-holder', category: 'community', title: 'Garri in the Pot', desc: 'Hold at least 1 $GARRI in your linked wallet (read live from Robinhood Chain).', target: 1, minLevel: 1, period: 'once', reward: { xp: 150, rep: 4, rp: 40 }, metric: (m) => Math.min(1, m.garriHeld) },
  { id: 'e-tutorial', category: 'exploration', title: 'Find Your Feet', desc: 'Complete the town tutorial.', target: 1, minLevel: 1, period: 'once', reward: { xp: 50, rep: 1, rp: 10 }, metric: (m) => (m.tutorialDone ? 1 : 0) },
  { id: 'e-districts', category: 'exploration', title: 'Walk the Town', desc: 'Visit all 11 districts.', target: DISTRICTS.length, minLevel: 1, period: 'once', reward: { xp: 150, rep: 3, rp: 40 }, metric: (m) => m.districts },
  { id: 'e-npcs', category: 'exploration', title: 'Greet the Neighbours', desc: 'Talk to 5 townspeople.', target: 5, minLevel: 1, period: 'once', reward: { xp: 80, rep: 2, rp: 20 }, metric: (m) => m.npcs },
  { id: 'e-secrets', category: 'exploration', title: 'Town Mysteries', desc: 'Find 3 hidden secrets around town.', target: 3, minLevel: 2, period: 'once', reward: { xp: 200, rep: 4, rp: 60 }, metric: (m) => m.secrets },
  { id: 'g-first', category: 'game', title: 'Into the Fire', desc: 'Finish your first GARRI SURVIVAL run.', target: 1, minLevel: 1, period: 'once', reward: { xp: 60, rep: 1, rp: 15 }, metric: (m) => m.gamesPlayed },
  { id: 'g-garri', category: 'game', title: 'Fry Master', desc: 'Make 50 cups of garri across all runs.', target: 50, minLevel: 1, period: 'once', reward: { xp: 180, rep: 3, rp: 40 }, metric: (m) => m.totalGarriMade },
  { id: 'g-win', category: 'game', title: 'Still Standing', desc: 'Win any GARRI SURVIVAL run.', target: 1, minLevel: 1, period: 'once', reward: { xp: 100, rep: 2, rp: 25 }, metric: (m) => m.wins },
  { id: 'g-target', category: 'game', title: 'Target Practice', desc: 'Reach a score of 2,000 in a single run.', target: 2000, minLevel: 1, period: 'once', reward: { xp: 120, rep: 2, rp: 30 }, metric: (m) => m.bestScore },
  { id: 'g-classic', category: 'game', title: 'Ten Days Strong', desc: 'Win a Classic run.', target: 1, minLevel: 1, period: 'once', reward: { xp: 150, rep: 3, rp: 40 }, metric: (m) => m.classicWins },
  { id: 'a-level5', category: 'achievement', title: 'Rising Citizen', desc: 'Reach level 5.', target: 5, minLevel: 1, period: 'once', reward: { xp: 0, rep: 5, rp: 50 }, metric: (m) => m.level },
  { id: 'a-ach', category: 'achievement', title: 'Trophy Shelf', desc: 'Unlock 6 achievements.', target: 6, minLevel: 1, period: 'once', reward: { xp: 150, rep: 3, rp: 40 }, metric: (m) => m.achievements },
  { id: 'a-level10', category: 'achievement', title: 'Pillar of the Town', desc: 'Reach level 10.', target: 10, minLevel: 5, period: 'once', reward: { xp: 0, rep: 10, rp: 150 }, metric: (m) => m.level },
]

export function questState(q: QuestDef, m: Metrics, claimed: boolean, now = new Date()): QuestState {
  if (claimed) return 'CLAIMED'
  if (m.level < q.minLevel) return 'LOCKED'
  if (q.metric(m) < q.target) return 'IN_PROGRESS'
  if (q.claimOpensAt && now < new Date(q.claimOpensAt)) return 'COMPLETED'
  return 'CLAIMABLE'
}

// ─── NFT Collection ─────────────────────────────────────────────────────────
export interface NftDef {
  id: string
  name: string
  tier: string
  desc: string
  requirement: string
  target: number
  minLevel: number
  palette: [string, string, string]
  glyph: string
  /** Requires data only the server can provide (rankings, referrals). */
  serverGated?: boolean
  /** Requirement can be met before claims open (e.g. season-end rankings). */
  claimOpensAt?: string
  metric: (m: Metrics) => number
}

export const NFTS: NftDef[] = [
  { id: 'genesis', name: 'Genesis Citizen', tier: 'Genesis', desc: 'For the first Citizens who built the town in Season 1.', requirement: 'Create a GARRI ID and finish the tutorial during Season 1.', target: 1, minLevel: 1, palette: ['#f2b632', '#2f3f9e', '#fdf4e1'], glyph: '◉', metric: (m) => (m.tutorialDone ? 1 : 0) },
  { id: 'survivor', name: 'Survivor Badge', tier: 'Core', desc: 'Proof you lasted ten days of GARRI SURVIVAL.', requirement: 'Win 1 Classic run.', target: 1, minLevel: 1, palette: ['#1f8a5b', '#f7e3b0', '#120f2e'], glyph: '⛨', metric: (m) => m.classicWins },
  { id: 'elite', name: 'Elite Survivor', tier: 'Elite', desc: 'For those who conquered the Harmattan with style.', requirement: 'Score 6,000+ in a Harmattan run.', target: 6000, minLevel: 3, palette: ['#d4552a', '#f2b632', '#0b0a1f'], glyph: '✦', metric: (m) => m.bestHarmattanScore },
  { id: 'champion', name: 'Town Champion', tier: 'Legendary', desc: 'Awarded to the top 10 Citizens of the season Arena.', requirement: 'Finish top 10 in the Season leaderboard (verified runs only). Claims open when the season closes.', target: 1, minLevel: 5, palette: ['#f2b632', '#a3322c', '#fdf4e1'], glyph: '♛', serverGated: true, claimOpensAt: '2026-12-31T23:59:59Z', metric: (m) => (m.seasonRank > 0 && m.seasonRank <= 10 ? 1 : 0) },
  { id: 'builder', name: 'Community Builder', tier: 'Community', desc: 'For Citizens who grew the town with real neighbours.', requirement: 'Have 3 referrals qualify.', target: 3, minLevel: 1, palette: ['#2f3f9e', '#1f8a5b', '#f7e3b0'], glyph: '❖', serverGated: true, metric: (m) => m.qualifiedReferrals },
  { id: 's1-harvest', name: 'Harmattan Harvest ’26', tier: 'Seasonal', desc: 'Seasonal collectible for Season 1.', requirement: 'Claim 5 Season 1 quests.', target: 5, minLevel: 2, palette: ['#f7e3b0', '#d4552a', '#2f3f9e'], glyph: '❂', metric: (m) => m.seasonQuestsClaimed },
]

export function nftState(n: NftDef, m: Metrics, claimed: boolean, now = new Date()): NftState {
  if (claimed) return 'CLAIMED'
  if (m.level < n.minLevel) return 'LOCKED'
  if (n.metric(m) < n.target) return 'IN_PROGRESS'
  if (n.claimOpensAt && now < new Date(n.claimOpensAt)) return 'IN_PROGRESS'
  return 'CLAIMABLE'
}
