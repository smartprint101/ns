-- সহজ রেগুলার অর্ডার + বকেয়া পেজ + কালেকশন-পেমেন্ট এক করা + প্যাকেজিং নতুন ধাপ
ALTER TABLE "regular_orders" ALTER COLUMN "product_name" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "regular_orders" ALTER COLUMN "quantity" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "regular_orders" ALTER COLUMN "price" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "packaging_orders" ALTER COLUMN "factory_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "in_collections" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "regular_customers" ADD COLUMN IF NOT EXISTS "dues_demoted_at" timestamp;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "regular_order_id" text;
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_regular_order_id_regular_orders_id_fk" FOREIGN KEY ("regular_order_id") REFERENCES "public"."regular_orders"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- পুরোনো কুরিয়ার কালেকশন/কন্ডিশনের পেমেন্টগুলো কালেকশন হিসাবে দেখাবে
UPDATE "payments" SET "in_collections" = true WHERE "source" IN ('COURIER_COLLECTION', 'CONDITION');
--> statement-breakpoint
-- প্যাকেজিং: পুরোনো ধাপগুলোকে নতুন সরল ফ্লোতে মাপা
UPDATE "packaging_orders" SET "stage" = 'PLACED' WHERE "stage" = 'ADVANCE';
--> statement-breakpoint
UPDATE "packaging_orders" SET "stage" = 'PRODUCTION' WHERE "stage" IN ('PRODUCTION_DONE', 'MATERIAL_RECEIVED');
