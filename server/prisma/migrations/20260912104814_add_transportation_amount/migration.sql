-- Documentation only: NOT registered in the _prisma_migrations tracking
-- table, applied directly via a one-off script instead, same reasoning as
-- 20260907065427_add_hardware_section (this project has pre-existing
-- Prisma migration drift, so `prisma migrate dev` is unsafe to run against
-- this database — see that migration's note).
ALTER TABLE "SalesBill" ADD COLUMN IF NOT EXISTS "transportationAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PurchaseBill" ADD COLUMN IF NOT EXISTS "transportationAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
