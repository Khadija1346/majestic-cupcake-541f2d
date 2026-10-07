/**
 * GARRI town ledger. The server is the source of truth for every value that
 * matters: XP, Reputation, scores, verification, referrals, rewards and roles.
 */
import { bigint, boolean, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' })

export const citizens = pgTable(
  'citizens',
  {
    id: text().primaryKey(),
    garriId: text('garri_id').notNull().unique(),
    name: text().notNull(),
    nameKey: text('name_key').notNull().unique(),
    avatar: jsonb().$type<{ outfit: string; cap: 'fila' | 'gele' | 'none'; skin: string }>().notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
    xp: integer().notNull().default(0),
    reputation: integer().notNull().default(0),
    rewardPoints: integer('reward_points').notNull().default(0),
    referralCode: text('referral_code').notNull().unique(),
    tutorial: jsonb().$type<{ moved: boolean; talkedElder: boolean; visitedBoard: boolean; done: boolean }>().notNull(),
    visited: jsonb().$type<string[]>().notNull().default([]),
    secrets: jsonb().$type<string[]>().notNull().default([]),
    npcs: jsonb().$type<string[]>().notNull().default([]),
    community: jsonb().$type<string[]>().notNull().default([]),
    achievements: jsonb().$type<{ id: string; at: string }[]>().notNull().default([]),
    inventory: jsonb().$type<{ id: string; name: string; icon: string; qty: number }[]>().notNull().default([]),
    walletAddress: text('wallet_address').unique(),
    walletLinkedAt: ts('wallet_linked_at'),
    garriBalance: text('garri_balance'),
    balanceCheckedAt: ts('balance_checked_at'),
    holdingSince: ts('holding_since'),
    deviceHash: text('device_hash'),
    ipHash: text('ip_hash'),
    status: text().notNull().default('active'), // active | flagged
    statusNote: text('status_note'),
    version: integer().notNull().default(0),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [index('citizens_device_idx').on(t.deviceHash), index('citizens_ip_idx').on(t.ipHash)],
)

export const sessions = pgTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  citizenId: text('citizen_id').notNull().references(() => citizens.id, { onDelete: 'cascade' }),
  createdAt: ts('created_at').notNull().defaultNow(),
  lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
})

/** A run is opened by the server, which picks the seed. Only open runs can be submitted. */
export const runs = pgTable(
  'runs',
  {
    id: text().primaryKey(),
    citizenId: text('citizen_id').notNull().references(() => citizens.id, { onDelete: 'cascade' }),
    mode: text().notNull(),
    seed: bigint({ mode: 'number' }).notNull(),
    status: text().notNull().default('active'), // active | submitted | abandoned | rejected
    startedAt: ts('started_at').notNull().defaultNow(),
    submittedAt: ts('submitted_at'),
  },
  (t) => [index('runs_citizen_idx').on(t.citizenId, t.status)],
)

export const games = pgTable(
  'games',
  {
    id: serial().primaryKey(),
    gameId: text('game_id').notNull().unique(),
    runId: text('run_id').notNull().unique(),
    citizenId: text('citizen_id').notNull().references(() => citizens.id, { onDelete: 'cascade' }),
    mode: text().notNull(),
    score: integer().notNull(),
    xp: integer().notNull(),
    won: boolean().notNull(),
    daysSurvived: integer('days_survived').notNull(),
    maxDays: integer('max_days').notNull(),
    garriMade: integer('garri_made').notNull(),
    reputationEarned: integer('reputation_earned').notNull(),
    seed: bigint({ mode: 'number' }).notNull(),
    actions: jsonb().$type<string[]>().notNull(),
    durationMs: integer('duration_ms').notNull(),
    playedAt: ts('played_at').notNull().defaultNow(),
    verification: text().notNull(), // pending | verified | flagged
    reviewNote: text('review_note'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: ts('reviewed_at'),
  },
  (t) => [index('games_board_idx').on(t.verification, t.playedAt), index('games_citizen_idx').on(t.citizenId, t.playedAt)],
)

export const questClaims = pgTable(
  'quest_claims',
  {
    id: serial().primaryKey(),
    citizenId: text('citizen_id').notNull().references(() => citizens.id, { onDelete: 'cascade' }),
    questKey: text('quest_key').notNull(),
    claimedAt: ts('claimed_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('quest_claims_unique').on(t.citizenId, t.questKey)],
)

/** NFT eligibility reservations. `mintTx` stays null until a real on-chain mint. */
export const nftClaims = pgTable(
  'nft_claims',
  {
    id: serial().primaryKey(),
    citizenId: text('citizen_id').notNull().references(() => citizens.id, { onDelete: 'cascade' }),
    nftId: text('nft_id').notNull(),
    claimedAt: ts('claimed_at').notNull().defaultNow(),
    review: text().notNull().default('pending'), // pending | verified | flagged
    reviewNote: text('review_note'),
    mintTx: text('mint_tx'),
  },
  (t) => [uniqueIndex('nft_claims_unique').on(t.citizenId, t.nftId)],
)

export const referrals = pgTable(
  'referrals',
  {
    id: serial().primaryKey(),
    referrerId: text('referrer_id').notNull().references(() => citizens.id, { onDelete: 'cascade' }),
    referredId: text('referred_id').notNull().unique().references(() => citizens.id, { onDelete: 'cascade' }),
    code: text().notNull(),
    status: text().notNull().default('PENDING'), // PENDING | QUALIFIED | REWARDED
    flag: text(), // non-null = held for moderator review
    createdAt: ts('created_at').notNull().defaultNow(),
    qualifiedAt: ts('qualified_at'),
    rewardedAt: ts('rewarded_at'),
    reviewedBy: text('reviewed_by'),
  },
  (t) => [index('referrals_referrer_idx').on(t.referrerId)],
)

/**
 * Official $GARRI reward entries. Nothing in the app writes here until the
 * GARRI team connects an official distribution (see src/lib/config.ts).
 */
export const rewardLedger = pgTable(
  'reward_ledger',
  {
    id: serial().primaryKey(),
    citizenId: text('citizen_id').notNull().references(() => citizens.id, { onDelete: 'cascade' }),
    walletAddress: text('wallet_address').notNull(),
    programme: text().notNull(),
    amount: text().notNull(), // decimal string, token units
    status: text().notNull().default('pending'), // pending | claimed
    txHash: text('tx_hash'),
    createdAt: ts('created_at').notNull().defaultNow(),
    claimedAt: ts('claimed_at'),
  },
  (t) => [index('reward_ledger_citizen_idx').on(t.citizenId)],
)

export const walletChallenges = pgTable('wallet_challenges', {
  nonce: text().primaryKey(),
  address: text().notNull(),
  purpose: text().notNull(), // link | restore
  citizenId: text('citizen_id'),
  message: text().notNull(),
  expiresAt: ts('expires_at').notNull(),
  usedAt: ts('used_at'),
})

/** Moderator / admin grants made by the game administrator. */
export const staff = pgTable('staff', {
  identityUserId: text('identity_user_id').primaryKey(),
  email: text().notNull(),
  role: text().notNull(), // moderator | admin
  grantedBy: text('granted_by').notNull(),
  grantedAt: ts('granted_at').notNull().defaultNow(),
  revokedAt: ts('revoked_at'),
})

export const modRequests = pgTable('mod_requests', {
  id: serial().primaryKey(),
  identityUserId: text('identity_user_id').notNull().unique(),
  email: text().notNull(),
  garriId: text('garri_id'),
  note: text(),
  status: text().notNull().default('pending'), // pending | approved | declined
  createdAt: ts('created_at').notNull().defaultNow(),
  decidedBy: text('decided_by'),
  decidedAt: ts('decided_at'),
})

export const modActions = pgTable(
  'mod_actions',
  {
    id: serial().primaryKey(),
    actor: text().notNull(),
    action: text().notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    note: text(),
    at: ts('at').notNull().defaultNow(),
  },
  (t) => [index('mod_actions_target_idx').on(t.targetType, t.targetId)],
)
