-- পাওনাদার: আমাদের থেকে কারা কত টাকা পাবে
CREATE TABLE IF NOT EXISTS "creditors" (
  "id" text PRIMARY KEY NOT NULL,
  "name" varchar(200) NOT NULL,
  "phone" varchar(40),
  "amount" numeric(14, 2) NOT NULL,
  "notes" text,
  "status" "record_status" DEFAULT 'ACTIVE' NOT NULL,
  "created_by_id" text NOT NULL,
  "updated_by_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creditors" ADD CONSTRAINT "creditors_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "creditors" ADD CONSTRAINT "creditors_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cred_status_idx" ON "creditors" ("status", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cred_name_idx" ON "creditors" ("name");
