-- Keep existing user IDs, roles, passwords, and activity history; only change login names.
UPDATE "users"
SET "name" = 'Shariful'
WHERE "name" = 'abdurrahman'
  AND NOT EXISTS (SELECT 1 FROM "users" WHERE "name" = 'Shariful');
--> statement-breakpoint
UPDATE "users"
SET "name" = 'Shariful'
WHERE "name" = 'শরীফুল'
  AND NOT EXISTS (SELECT 1 FROM "users" WHERE "name" = 'Shariful');
--> statement-breakpoint
UPDATE "users"
SET "name" = 'Saiful'
WHERE "name" = 'সাইফুল'
  AND NOT EXISTS (SELECT 1 FROM "users" WHERE "name" = 'Saiful');
--> statement-breakpoint
UPDATE "users"
SET "name" = 'Rahman'
WHERE "name" = 'রহমান'
  AND NOT EXISTS (SELECT 1 FROM "users" WHERE "name" = 'Rahman');
--> statement-breakpoint
UPDATE "users"
SET "name" = 'Nirob'
WHERE "name" = 'নিরব'
  AND NOT EXISTS (SELECT 1 FROM "users" WHERE "name" = 'Nirob');
