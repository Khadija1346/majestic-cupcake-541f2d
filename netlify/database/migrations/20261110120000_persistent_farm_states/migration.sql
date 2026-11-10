CREATE TABLE "farm_states" (
  "citizen_id" text PRIMARY KEY NOT NULL,
  "plots" jsonb NOT NULL,
  "seeds" integer DEFAULT 3 NOT NULL,
  "cassava" integer DEFAULT 0 NOT NULL,
  "garri" integer DEFAULT 0 NOT NULL,
  "version" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "farm_states_citizen_id_citizens_id_fk"
    FOREIGN KEY ("citizen_id") REFERENCES "citizens"("id") ON DELETE CASCADE
);
