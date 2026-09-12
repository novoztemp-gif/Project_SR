-- Documentation only: NOT registered in the _prisma_migrations tracking
-- table, applied directly via a one-off script instead — see
-- 20260907065427_add_hardware_section for why (pre-existing Prisma
-- migration drift makes `prisma migrate dev` unsafe against this database).
-- Nullable because historical PurchaseItem rows predate per-item godowns;
-- PurchaseBill.godownId is kept as a derived/display fallback for those.
ALTER TABLE "PurchaseItem" ADD COLUMN IF NOT EXISTS "godownId" TEXT;
