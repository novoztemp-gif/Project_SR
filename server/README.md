# SR Billing — Backend

Node.js + Express + PostgreSQL (Prisma) API for the SR Plywood & Glasses billing app.

## Prerequisites
- Node.js 18+
- A running PostgreSQL instance

## Setup

```bash
cd server
cp .env.example .env          # then edit DATABASE_URL + JWT_SECRET
npm install
```

Create the database (one-time), e.g.:

```bash
createdb sr_billing
# or in psql:  CREATE DATABASE sr_billing;
```

Run the migration and seed the demo data:

```bash
npm run prisma:migrate -- --name init   # creates tables
npm run seed                            # loads godowns, products, counters, bills, purchases
```

> No Postgres handy? `npm run prisma:migrate` requires a live DB. For a throwaway
> local DB you can also use `npx prisma db push` to create the schema without a
> migration history, then `npm run seed`.

## Run

```bash
npm run dev      # tsx watch, http://localhost:4000
# or
npm run build && npm start
```

Health check: `GET http://localhost:4000/health`

## Seed credentials
| User | id | Password |
|------|-----|----------|
| Owner (admin) | `u-3` | `SEED_ADMIN_PASSWORD` (default `admin123`) |
| Counters 1–5 | `billing_a` … `billing_e` | `SEED_COUNTER_PASSWORD` (default `counter123`) |

## API surface (all under `/api`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET  | `/auth/users` | public | Login cards (active counters + admin) |
| POST | `/auth/login` | public | `{ userId, password }` → `{ token, user }` |
| GET  | `/auth/me` | bearer | Current user |
| POST | `/auth/change-password` | bearer | `{ currentPassword, newPassword }` |
| GET  | `/counters` | admin | List counters |
| POST | `/counters` | admin | Create counter |
| PUT  | `/counters/:id` | admin | Update counter |
| DELETE | `/counters/:id` | admin | Deactivate counter |
| PUT  | `/counters/reorder/all` | admin | `{ ids }` |
| GET  | `/inventory/godowns` | bearer | All godowns |
| GET  | `/inventory/godowns/by-section?section=` | bearer | Godowns holding a section |
| GET  | `/inventory/products?section=&godownId=` | bearer | Section-scoped |
| GET  | `/inventory/products/search?q=` | bearer | Scoped search |
| POST/PUT/DELETE | `/inventory/products[/:id]` | bearer | Product definitions |
| POST | `/inventory/transfers` | bearer | Move stock between godowns |
| GET  | `/inventory/transfers` | admin | Transfer log |
| POST | `/bills` | bearer | Create bill (atomic stock decrement) |
| GET  | `/bills?from=&to=&section=&userId=` | bearer | Section-scoped list |
| GET  | `/bills/today` | bearer | Today's bills |
| GET  | `/bills/:id` | bearer | Single bill |
| GET  | `/purchases` | bearer | Section-scoped list |
| POST | `/purchases` | bearer | Create (stock pending) |
| GET  | `/purchases/:id` | bearer | Single purchase |
| POST | `/purchases/:id/apply-print` | bearer | Commit stock + mark printed |

## Notes
- **Auth**: JWT bearer tokens. Sections a user may access come from their `processes`
  (admins get all). Section access is enforced server-side on every data route.
- **Reports** are computed on the client from `/bills` data (matching the existing
  frontend selectors), so there are no separate report endpoints.
- **Bill numbers** and **voucher numbers** are assigned server-side inside the
  create transaction.
