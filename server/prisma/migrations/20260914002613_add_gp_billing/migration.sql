-- Documentation only: NOT registered in the _prisma_migrations tracking
-- table, applied directly via a one-off script instead — see
-- 20260907065427_add_hardware_section for why (pre-existing Prisma
-- migration drift makes `prisma migrate dev` unsafe against this database).
-- Adds the Glass & Plywood billing split: a discriminator column and its
-- own independent voucher-number sequence, without touching the existing
-- billNumber column/values used by every bill (general and glass_plywood
-- alike).
ALTER TABLE "SalesBill" ADD COLUMN IF NOT EXISTS "billType" TEXT NOT NULL DEFAULT 'general';
ALTER TABLE "SalesBill" ADD COLUMN IF NOT EXISTS "gpVoucherNumber" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "SalesBill_gpVoucherNumber_key" ON "SalesBill"("gpVoucherNumber");
CREATE INDEX IF NOT EXISTS "SalesBill_billType_idx" ON "SalesBill"("billType");
