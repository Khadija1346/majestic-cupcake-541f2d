CREATE TABLE "citizens" (
	"id" text PRIMARY KEY,
	"garri_id" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"name_key" text NOT NULL UNIQUE,
	"avatar" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"reputation" integer DEFAULT 0 NOT NULL,
	"reward_points" integer DEFAULT 0 NOT NULL,
	"referral_code" text NOT NULL UNIQUE,
	"tutorial" jsonb NOT NULL,
	"visited" jsonb DEFAULT '[]' NOT NULL,
	"secrets" jsonb DEFAULT '[]' NOT NULL,
	"npcs" jsonb DEFAULT '[]' NOT NULL,
	"community" jsonb DEFAULT '[]' NOT NULL,
	"achievements" jsonb DEFAULT '[]' NOT NULL,
	"inventory" jsonb DEFAULT '[]' NOT NULL,
	"wallet_address" text UNIQUE,
	"wallet_linked_at" timestamp with time zone,
	"garri_balance" text,
	"balance_checked_at" timestamp with time zone,
	"holding_since" timestamp with time zone,
	"device_hash" text,
	"ip_hash" text,
	"status" text DEFAULT 'active' NOT NULL,
	"status_note" text,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" serial PRIMARY KEY,
	"game_id" text NOT NULL UNIQUE,
	"run_id" text NOT NULL UNIQUE,
	"citizen_id" text NOT NULL,
	"mode" text NOT NULL,
	"score" integer NOT NULL,
	"xp" integer NOT NULL,
	"won" boolean NOT NULL,
	"days_survived" integer NOT NULL,
	"max_days" integer NOT NULL,
	"garri_made" integer NOT NULL,
	"reputation_earned" integer NOT NULL,
	"seed" bigint NOT NULL,
	"actions" jsonb NOT NULL,
	"duration_ms" integer NOT NULL,
	"played_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verification" text NOT NULL,
	"review_note" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "mod_actions" (
	"id" serial PRIMARY KEY,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"note" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mod_requests" (
	"id" serial PRIMARY KEY,
	"identity_user_id" text NOT NULL UNIQUE,
	"email" text NOT NULL,
	"garri_id" text,
	"note" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "nft_claims" (
	"id" serial PRIMARY KEY,
	"citizen_id" text NOT NULL,
	"nft_id" text NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"review" text DEFAULT 'pending' NOT NULL,
	"review_note" text,
	"mint_tx" text
);
--> statement-breakpoint
CREATE TABLE "quest_claims" (
	"id" serial PRIMARY KEY,
	"citizen_id" text NOT NULL,
	"quest_key" text NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" serial PRIMARY KEY,
	"referrer_id" text NOT NULL,
	"referred_id" text NOT NULL UNIQUE,
	"code" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"flag" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"qualified_at" timestamp with time zone,
	"rewarded_at" timestamp with time zone,
	"reviewed_by" text
);
--> statement-breakpoint
CREATE TABLE "reward_ledger" (
	"id" serial PRIMARY KEY,
	"citizen_id" text NOT NULL,
	"wallet_address" text NOT NULL,
	"programme" text NOT NULL,
	"amount" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"tx_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" text PRIMARY KEY,
	"citizen_id" text NOT NULL,
	"mode" text NOT NULL,
	"seed" bigint NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY,
	"citizen_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"identity_user_id" text PRIMARY KEY,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"granted_by" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "wallet_challenges" (
	"nonce" text PRIMARY KEY,
	"address" text NOT NULL,
	"purpose" text NOT NULL,
	"citizen_id" text,
	"message" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "citizens_device_idx" ON "citizens" ("device_hash");--> statement-breakpoint
CREATE INDEX "citizens_ip_idx" ON "citizens" ("ip_hash");--> statement-breakpoint
CREATE INDEX "games_board_idx" ON "games" ("verification","played_at");--> statement-breakpoint
CREATE INDEX "games_citizen_idx" ON "games" ("citizen_id","played_at");--> statement-breakpoint
CREATE INDEX "mod_actions_target_idx" ON "mod_actions" ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "nft_claims_unique" ON "nft_claims" ("citizen_id","nft_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quest_claims_unique" ON "quest_claims" ("citizen_id","quest_key");--> statement-breakpoint
CREATE INDEX "referrals_referrer_idx" ON "referrals" ("referrer_id");--> statement-breakpoint
CREATE INDEX "reward_ledger_citizen_idx" ON "reward_ledger" ("citizen_id");--> statement-breakpoint
CREATE INDEX "runs_citizen_idx" ON "runs" ("citizen_id","status");--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_citizen_id_citizens_id_fkey" FOREIGN KEY ("citizen_id") REFERENCES "citizens"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "nft_claims" ADD CONSTRAINT "nft_claims_citizen_id_citizens_id_fkey" FOREIGN KEY ("citizen_id") REFERENCES "citizens"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quest_claims" ADD CONSTRAINT "quest_claims_citizen_id_citizens_id_fkey" FOREIGN KEY ("citizen_id") REFERENCES "citizens"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_citizens_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "citizens"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_id_citizens_id_fkey" FOREIGN KEY ("referred_id") REFERENCES "citizens"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reward_ledger" ADD CONSTRAINT "reward_ledger_citizen_id_citizens_id_fkey" FOREIGN KEY ("citizen_id") REFERENCES "citizens"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_citizen_id_citizens_id_fkey" FOREIGN KEY ("citizen_id") REFERENCES "citizens"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_citizen_id_citizens_id_fkey" FOREIGN KEY ("citizen_id") REFERENCES "citizens"("id") ON DELETE CASCADE;