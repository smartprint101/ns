# এনএস ট্রেডার্স — বিজনেস ম্যানেজমেন্ট অ্যাপ

এক-মালিকানা ব্যবসার দৈনন্দিন কাজ — **রেগুলার অর্ডার, প্যাকেজিং অর্ডার, কন্ডিশন, কুরিয়ার কালেকশন, পেমেন্ট (মাল্টি-অর্ডার অ্যালোকেশনসহ), খরচ, পার্টি/ফ্যাক্টরি লেজার, টাস্ক, ক্যাশ/ব্যাংক/মোবাইল ব্যালান্স, রিপোর্ট** — সব এক জায়গায়। Private, login-protected, Bengali-first, mobile-first PWA।

---

## ১) কী দিয়ে বানানো (Stack)

| অংশ | টেকনোলজি |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS 4 |
| DB ORM | Drizzle ORM |
| Database | **Local dev:** PGlite (embedded PostgreSQL — আলাদা DB সার্ভার লাগে না) · **Production:** hosted PostgreSQL (Vercel Postgres / Neon / Supabase) |
| Auth | নাম + পাসওয়ার্ড (bcrypt হ্যাশ) → JWT session cookie (jose), middleware-protected |
| PWA | manifest + service worker (`/manifest.webmanifest`, `/sw.js`) |

---

## ২) লোকালে চালানো (PGlite — ডিফল্ট, সবচেয়ে সহজ)

```bash
cp .env.example .env      # তারপর .env এ AUTH_SECRET + SEED_ADMIN_PASSWORD বসাও
npm install
npm run db:migrate        # migration প্রয়োগ + প্রথম seed (অ্যাকাউন্ট, Owner, staff)
npm run dev               # http://localhost:3000
```

- PGlite মোডে ডাটাবেস ফাইল `PGLITE_DATA_DIR` ফোল্ডারে থাকে (ডিফল্ট `./.pgdata`) — আলাদা কিছু install করতে হয় না।
- প্রথম boot/seed-এ তৈরি হয়: **৫টি অ্যাকাউন্ট** (ক্যাশ, ডাচ-বাংলা, ব্র্যাক, বিকাশ, নগদ), **Owner** (শরীফুল), এবং `SEED_STAFF_PASSWORD` দেওয়া থাকলে **স্টাফ** (সাইফুল, রহমান, নিরব)।
- সব পাসওয়ার্ড bcrypt হ্যাশ হয়ে জমা হয় — env-তেই প্রথম পাসওয়ার্ড আসে, ডাটাবেসে কখনো plain text থাকে না।

### কাম্য `.env` (লোকাল ডেমো — এখন যেটা চলছে)

```env
DB_DRIVER="pglite"
PGLITE_DATA_DIR="/home/user/.cache/ns-pgdata"
AUTH_SECRET="...(32+ chars random)..."
SEED_ADMIN_NAME="শরীফুল"
SEED_ADMIN_PASSWORD="...(লাইভে শক্ত পাসওয়ার্ড)..."
SEED_STAFF_PASSWORD="...(staff-দের প্রথম পাসওয়ার্ড)..."
SEED_DEMO="1"            # ডেমো factory/cylinder/party চাইলে 1, প্রোডাকশনে 0
RUN_MIGRATIONS="1"       # boot-এ অটো migration (next start)
```

---

## ৩) ★ ডাটাবেস সুইচ করা (PGlite ↔ Vercel Postgres) — শুধু env বদলে

অ্যাপ দুই driver-এ চলে। **কোডে কিছু বদলাতে হয় না — শুধু environment variable:**

```env
DB_DRIVER="postgres"
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require"
```

**⚠️ খুব গুরুত্বপূর্ণ — সুইচ করলে ডাটার কী হবে:**

- PGlite (লোকাল) আর Vercel Postgres (রিমোট) — **দুইটা আলাদা ডাটাবেস। একটার ডাটা অন্যটায় অটোমেটিক যায় না।**
- রিমোটে প্রথমবার গেলে ডাটাবেস থাকবে **একদম ফাঁকা**। সেখানে migration চালবে (`npm run db:migrate` রিমোট env দিয়ে) → আবার seed হবে: ৫টা অ্যাকাউন্ট + Owner + (env থাকলে) ৩ জন স্টাফ — আগের PGlite-এর ইউজার/পাসওয়ার্ড **নয়**, env-এ দেওয়া পাসওয়ার্ড দিয়ে নতুন করে।
- লোকালের ডেমো/টেস্ট ডাটা (অর্ডার, পেমেন্ট ইত্যাদি) লোকালেই থেকে যায় — হারায় না, কিন্তু রিমোটে দেখা যাবে না।
- লোকাল ডাটা রিমোটে নিতে চাইলে: Postgres ডাম্প নেওয়ার সেরা পথ হলো — লোকালটাও একই `DATABASE_URL` প্যাটার্নের Postgres-এ রাখা (যেমন Docker Postgres), তারপর `pg_dump`/`pg_restore`। ছোট ব্যবসার নতুন শুরুর জন্য সুপারিশ: **রিমোটে fresh শুরু করো** — opening balance-গুলো অ্যাকাউন্ট অ্যাজাস্টমেন্ট দিয়ে বসিয়ে নাও।
- একই রিমোট ডাটাবেসে বারবার deploy/সুইচ করলে ডাটা অক্ষত থাকে — migration শুধু স্কিমা আপডেট করে, কখনোডাটা মুছে না (`db:push`/`DROP` এই প্রজেক্টে নেই)।

---

## ৪) Vercel-এ Deploy (হাজির করা ধাপে ধাপে)

1. **Repo push করো GitHub-এ** (এই ব্রাঞ্চই যথেষ্ট)।
2. **Vercel Postgres বানাও:** Vercel ড্যাশবোর্ড → প্রোজেক্ট → **Storage** → "Postgres" Create → প্রোজেক্টের সাথে link। এতে `POSTGRES_URL` ও অন্যান্য env অটো যুক্ত হয় —
   আমাদের অ্যাপ `DATABASE_URL` নাম চায়, তাই Settings → Environment Variables-এ:
   ```
   DATABASE_URL = ${POSTGRES_URL}   (বা Neon/Supabase হলে সেই connection string)
   DB_DRIVER    = postgres
   AUTH_SECRET  = (openssl rand -base64 32 দিয়ে বানানো)
   SEED_ADMIN_NAME = শরীফুল
   SEED_ADMIN_PASSWORD = (শক্ত পাসওয়ার্ড — শুধু প্রথম seed-এ লাগে)
   SEED_STAFF_PASSWORD = (স্টাফদের প্রথম পাসওয়ার্ড)
   SEED_DEMO = 0
   RUN_MIGRATIONS = 1
   ```
3. **Deploy** চাপাও। প্রথম boot-এ `instrumentation.ts` থেকে migration + seed অটো চলবে (ফাঁকা DB-তে)।
   - অটো মাইগ্রেশন না চাইলে `RUN_MIGRATIONS=0` রেখে লোকাল থেকে একবার চালাও:
     ```bash
     DB_DRIVER=postgres DATABASE_URL="..." npx tsx scripts/migrate.ts
     ```
4. ব্রাউজারে খুলে **শরীফুল + SEED_ADMIN_PASSWORD** দিয়ে লগইন → সেটিংস থেকে পাসওয়ার্ড বদলাও।
5. ফোনে খুলে **Add to Home Screen** — PWA হিসেবে ইনস্টল হবে।

> Neon/Supabase ব্যবহার করলে একই — শুধু `DATABASE_URL`-এ তাদের connection string বসাও। `RUN_MIGRATIONS=0` রেখে ধাপ ৩-এর লোকাল কমান্ডে migration দাও।

---

## ৫) কমান্ড সারসংক্ষেপ

| কমান্ড | কাজ |
|---|---|
| `npm run dev` | ডেভ সার্ভার |
| `npm run build && npm start` | প্রোডাকশন বিল্ড + সার্ভ |
| `npm run db:migrate` | migration + (ফাঁকা DB হলে) seed |
| `npm run db:seed` | seed (idempotent — বিদ্যমান ডাটা ছোঁয় না) |
| `npm run db:generate` | schema বদলালে নতুন migration ফাইল বানায় |
| `npm run test:scenarios` | **spec §68-এর ১০টা বিজনেস সিনারিও এন্ড-টু-এন্ড টেস্ট** |
| `npm run lint` / `npx tsc --noEmit` | লিন্ট / টাইপচেক |

---

## ৬) বিজনেস নিয়ম যেভাবে বাস্তবায়িত (সংক্ষেপে)

- **রেগুলার অর্ডার:** `বুক হয়েছে → রেডি → কুরিয়ার দেওয়া → (কন্ডিশন থাকলে) কন্ডিশনের অপেক্ষা → সম্পন্ন`। কুরিয়ার ট্র্যাকিং নেই — শুধু "দেওয়া হয়েছে কিনা"।
- **কন্ডিশন গ্রহণ:** টাকা লিখলে **কাছাকাছি অপেক্ষমাণ কন্ডিশনগুলোর popup** → বেছে নিলে এক DB transaction-এ Payment(source=CONDITION) + অর্ডার সম্পন্ন + ব্যালান্স বাড়ে + যুক্ত পেন্ডিং কালেকশন বাতিল হয় + পুরো অর্ডারের ইভেন্ট লগ থাকে।
- **প্যাকেজিং:** workType অনুযায়ী আলাদা স্টেজ-ফ্লো (সিলিন্ডার+প্যাকেট / প্যাকেট / আর্ট পেপার)। "অ্যাডভান্স না দিলে কাজ শুরু হয় না" — হিন্ট থাকে, বাধ্য করে না। সিলিন্ডার বাছলে **ফ্যাক্টরি অটো-সিলেক্ট**। Total/Extra/Final KG ও ম্যানুয়াল Total Bill।
- **পেমেন্ট:** অটো txn নম্বর; **এক পেমেন্ট একাধিক অর্ডারে ভাগ (allocation)** — পার্টি লেজারে একবারই দেখায়। সব এক DB transaction (atomic)।
- **ব্যালান্স:** `opening + Σ(non-voided transactions)` — কখনো ম্যানুয়াল এডিট না; Owner **অ্যাজাস্টমেন্ট** transaction দিতে পারে। ভুল এন্ট্রি → Owner **বাতিল** করে (কারণ লিখে) → reversal transaction।
- **ডুপ্লিকেট সতর্কতা:** একই ইউজার + একই টাকা + মিলে যাওয়া বিবরণ (২৪ ঘণ্টায়) → warning দেখায়, **hard-block করে না** — confirm করলেই সেভ।
- **ড্যাশবোর্ড pending-first:** সবচেয়ে পুরোনো চলমান কাজ সবার উপরে, "১৫ দিন ধরে চলছে" ব্যাজসহ; আজকের কালেকশন/খরচ; অ্যাকাউন্ট ব্যালান্স; আজকের পেন্ডিং কুরিয়ার কালেকশন হাইলাইট।
- **টাস্ক:** অ্যাসাইন → নোটিফিকেশন; সম্পন্ন/বাতিলে নোট বাধ্যতামূলক; টাস্ক-লিংকড খরচ টাস্কে দেখায়।
- **যেকোনো লিখিত রেকর্ডে** `createdBy / updatedBy / updatedAt` + গুরুত্বপূর্ণ ঘটনায় event log (ডিটেইল পেজের "অ্যাক্টিভিটি" অংশে)।

## ৭) অ্যাকসেপ্ট্যান্স টেস্ট (spec §68)

`npm run test:scenarios` — ১০টা সিনারিও (কন্ডিশন ফ্লো ও closest-match, সিলিন্ডার→ফ্যাক্টরি, পার্টি লেজার/ব্যালান্স precision, মাল্টি-অর্ডার অ্যালোকেশনের এক-পেমেন্ট নিয়ম, টাস্ক+খরচ, ডুপ্লিকেট warning, oldest-first তালিকা) service layer দিয়ে সত্যিকারের ডাটাবেসে চলে। শেষ রান: **৯/৯ পাস** (S3+S4 একসাথে)।

## ৮) নিরাপত্তা

- bcrypt পাসওয়ার্ড হ্যাশ; HS256 JWT cookie (`httpOnly`, `sameSite=lax`, prod-এ `secure`)
- middleware-এ প্রতিটা রুট login-protected; OWNER-only অ্যাকশন দুই স্তরে (UI লুকানো + service-এ role চেক)
- Login rate-limit (৫ ভুল → ৫ মিনিট ব্লক), Zod-এ সব ইনপুট validation, Drizzle parameterised query
- কোনো সিক্রেট ক্লায়েন্টে যায় না; `.env` কখনো commit হয় না (`.env.example` মাত্র)

## ৯) ফোল্ডার ম্যাপ

```
src/
  app/(app)/…        — dashboard, orders, conditions, packaging, parties, factories,
                       cylinders, customers, collections, payments, expenses, accounts,
                       tasks, reports, search, team, settings, notifications
  app/actions/…      — server actions (login, orders, payments, …)
  components/…       — UI primitives, app-shell, ফর্ম (client)
  server/db/…        — drizzle schema, client (pglite|postgres), seed
  server/services/…  — সব বিজনেস লজিক + transaction-সমৃদ্ধ write path
drizzle/             — SQL migration ফাইল
scripts/             — migrate.ts, make-icons.mjs, scenario-tests.ts
public/              — manifest, icons, sw.js
```
