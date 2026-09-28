CREATE TYPE "public"."account_kind" AS ENUM('CASH', 'BANK', 'MOBILE');--> statement-breakpoint
CREATE TYPE "public"."collection_status" AS ENUM('PENDING', 'RECEIVED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."expense_category" AS ENUM('FACTORY', 'PURCHASE', 'COURIER', 'PACKAGING', 'TRANSPORT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."packaging_stage" AS ENUM('PLACED', 'ADVANCE', 'DESIGN', 'CYLINDER_SENT', 'CYLINDER_READY', 'PRODUCTION', 'PRODUCTION_DONE', 'MATERIAL_RECEIVED', 'DELIVERED', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."payment_source" AS ENUM('MANUAL', 'CONDITION', 'COURIER_COLLECTION');--> statement-breakpoint
CREATE TYPE "public"."record_status" AS ENUM('ACTIVE', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."regular_stage" AS ENUM('PLACED', 'READY', 'COURIER_GIVEN', 'CONDITION_PENDING', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('OWNER', 'STAFF');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('PENDING', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."txn_kind" AS ENUM('PAYMENT_IN', 'PAYMENT_REVERSAL', 'EXPENSE_OUT', 'EXPENSE_REVERSAL', 'ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."work_type" AS ENUM('CYLINDER_PACKET', 'PACKET', 'ART_PAPER');--> statement-breakpoint
CREATE TABLE "account_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"kind" "txn_kind" NOT NULL,
	"payment_id" text,
	"expense_id" text,
	"adjustment_id" text,
	"note" text,
	"date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"key" varchar(40) NOT NULL,
	"name_bn" varchar(120) NOT NULL,
	"kind" "account_kind" NOT NULL,
	"opening_balance" numeric(14, 2) DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "adjustments" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"reason" text NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courier_collections" (
	"id" text PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"expected_amount" numeric(14, 2) NOT NULL,
	"received_amount" numeric(14, 2),
	"account_id" text,
	"payment_id" text,
	"status" "collection_status" DEFAULT 'PENDING' NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"received_at" timestamp,
	"notes" text,
	"created_by_id" text NOT NULL,
	"received_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cylinders" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"factory_id" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cylinders_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "event_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"entity" varchar(40) NOT NULL,
	"entity_id" text NOT NULL,
	"action" varchar(40) NOT NULL,
	"detail" text,
	"actor_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"category" "expense_category" NOT NULL,
	"description" text NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"account_id" text NOT NULL,
	"party_id" text,
	"factory_id" text,
	"regular_order_id" text,
	"packaging_order_id" text,
	"task_id" text,
	"voided_at" timestamp,
	"void_reason" text,
	"replaced_by_id" text,
	"created_by_id" text NOT NULL,
	"updated_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "factories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"phone" varchar(40),
	"address" text,
	"notes" text,
	"opening_due" numeric(14, 2) DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "factories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" varchar(40) NOT NULL,
	"message" text NOT NULL,
	"link" text,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packaging_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"order_no" serial NOT NULL,
	"party_id" text NOT NULL,
	"work_type" "work_type" NOT NULL,
	"total_kg" numeric(12, 2) NOT NULL,
	"extra_kg" numeric(12, 2) DEFAULT 0 NOT NULL,
	"final_kg" numeric(12, 2) NOT NULL,
	"total_bill" numeric(14, 2) NOT NULL,
	"factory_id" text NOT NULL,
	"cylinder_id" text,
	"notes" text,
	"stage" "packaging_stage" DEFAULT 'PLACED' NOT NULL,
	"status" "record_status" DEFAULT 'ACTIVE' NOT NULL,
	"completed_at" timestamp,
	"cancel_reason" text,
	"cancelled_at" timestamp,
	"created_by_id" text NOT NULL,
	"updated_by_id" text,
	"cancelled_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "packaging_orders_order_no_unique" UNIQUE("order_no")
);
--> statement-breakpoint
CREATE TABLE "packaging_parties" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"phone" varchar(40),
	"address" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "packaging_parties_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_id" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"regular_order_id" text,
	"packaging_order_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"txn_no" serial NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"account_id" text NOT NULL,
	"party_id" text,
	"customer_id" text,
	"source" "payment_source" DEFAULT 'MANUAL' NOT NULL,
	"is_advance" boolean DEFAULT false NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"voided_at" timestamp,
	"void_reason" text,
	"replaced_by_id" text,
	"created_by_id" text NOT NULL,
	"updated_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payments_txn_no_unique" UNIQUE("txn_no")
);
--> statement-breakpoint
CREATE TABLE "regular_customers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"phone" varchar(40),
	"address" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regular_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"order_no" serial NOT NULL,
	"customer_id" text NOT NULL,
	"product_name" varchar(250) NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"price" numeric(14, 2) NOT NULL,
	"delivery_charge" numeric(14, 2) DEFAULT 0 NOT NULL,
	"total_amount" numeric(14, 2) NOT NULL,
	"address" text,
	"notes" text,
	"has_condition" boolean DEFAULT false NOT NULL,
	"stage" "regular_stage" DEFAULT 'PLACED' NOT NULL,
	"status" "record_status" DEFAULT 'ACTIVE' NOT NULL,
	"courier_given_at" timestamp,
	"condition_amount" numeric(14, 2),
	"condition_received_at" timestamp,
	"completed_at" timestamp,
	"cancel_reason" text,
	"cancelled_at" timestamp,
	"created_by_id" text NOT NULL,
	"updated_by_id" text,
	"cancelled_by_id" text,
	"condition_received_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "regular_orders_order_no_unique" UNIQUE("order_no")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"title" varchar(250) NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'PENDING' NOT NULL,
	"completion_note" text,
	"completed_at" timestamp,
	"cancelled_at" timestamp,
	"assigned_to_id" text NOT NULL,
	"created_by_id" text NOT NULL,
	"completed_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'STAFF' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_collections" ADD CONSTRAINT "courier_collections_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_collections" ADD CONSTRAINT "courier_collections_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_collections" ADD CONSTRAINT "courier_collections_received_by_id_users_id_fk" FOREIGN KEY ("received_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cylinders" ADD CONSTRAINT "cylinders_factory_id_factories_id_fk" FOREIGN KEY ("factory_id") REFERENCES "public"."factories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_party_id_packaging_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."packaging_parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_factory_id_factories_id_fk" FOREIGN KEY ("factory_id") REFERENCES "public"."factories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_regular_order_id_regular_orders_id_fk" FOREIGN KEY ("regular_order_id") REFERENCES "public"."regular_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_packaging_order_id_packaging_orders_id_fk" FOREIGN KEY ("packaging_order_id") REFERENCES "public"."packaging_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packaging_orders" ADD CONSTRAINT "packaging_orders_party_id_packaging_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."packaging_parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packaging_orders" ADD CONSTRAINT "packaging_orders_factory_id_factories_id_fk" FOREIGN KEY ("factory_id") REFERENCES "public"."factories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packaging_orders" ADD CONSTRAINT "packaging_orders_cylinder_id_cylinders_id_fk" FOREIGN KEY ("cylinder_id") REFERENCES "public"."cylinders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packaging_orders" ADD CONSTRAINT "packaging_orders_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packaging_orders" ADD CONSTRAINT "packaging_orders_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packaging_orders" ADD CONSTRAINT "packaging_orders_cancelled_by_id_users_id_fk" FOREIGN KEY ("cancelled_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_regular_order_id_regular_orders_id_fk" FOREIGN KEY ("regular_order_id") REFERENCES "public"."regular_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_packaging_order_id_packaging_orders_id_fk" FOREIGN KEY ("packaging_order_id") REFERENCES "public"."packaging_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_party_id_packaging_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."packaging_parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_regular_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."regular_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regular_orders" ADD CONSTRAINT "regular_orders_customer_id_regular_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."regular_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regular_orders" ADD CONSTRAINT "regular_orders_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regular_orders" ADD CONSTRAINT "regular_orders_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regular_orders" ADD CONSTRAINT "regular_orders_cancelled_by_id_users_id_fk" FOREIGN KEY ("cancelled_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regular_orders" ADD CONSTRAINT "regular_orders_condition_received_by_id_users_id_fk" FOREIGN KEY ("condition_received_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_id_users_id_fk" FOREIGN KEY ("completed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "at_account_date_idx" ON "account_transactions" USING btree ("account_id","date");--> statement-breakpoint
CREATE INDEX "cc_status_idx" ON "courier_collections" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "cyl_factory_idx" ON "cylinders" USING btree ("factory_id");--> statement-breakpoint
CREATE INDEX "ev_entity_idx" ON "event_logs" USING btree ("entity","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "exp_date_idx" ON "expenses" USING btree ("date");--> statement-breakpoint
CREATE INDEX "exp_category_idx" ON "expenses" USING btree ("category");--> statement-breakpoint
CREATE INDEX "notif_user_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "po_status_stage_idx" ON "packaging_orders" USING btree ("status","stage","created_at");--> statement-breakpoint
CREATE INDEX "po_party_idx" ON "packaging_orders" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "pa_regular_idx" ON "payment_allocations" USING btree ("regular_order_id");--> statement-breakpoint
CREATE INDEX "pa_packaging_idx" ON "payment_allocations" USING btree ("packaging_order_id");--> statement-breakpoint
CREATE INDEX "pa_payment_idx" ON "payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "pay_date_idx" ON "payments" USING btree ("date");--> statement-breakpoint
CREATE INDEX "pay_party_idx" ON "payments" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "pay_customer_idx" ON "payments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "rc_name_idx" ON "regular_customers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "rc_phone_idx" ON "regular_customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "ro_status_stage_idx" ON "regular_orders" USING btree ("status","stage","created_at");--> statement-breakpoint
CREATE INDEX "ro_customer_idx" ON "regular_orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "task_status_idx" ON "tasks" USING btree ("status","created_at");--> statement-breakpoint
-- Friendly starting numbers: Regular orders from #1001, Packaging PKG-101, TXN-10001
ALTER SEQUENCE "public"."regular_orders_order_no_seq" RESTART WITH 1001;--> statement-breakpoint
ALTER SEQUENCE "public"."packaging_orders_order_no_seq" RESTART WITH 101;--> statement-breakpoint
ALTER SEQUENCE "public"."payments_txn_no_seq" RESTART WITH 10001;
