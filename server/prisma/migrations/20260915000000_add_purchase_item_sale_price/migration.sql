-- Documentation only: NOT registered in the _prisma_migrations tracking
-- table, applied directly via a one-off script instead — see
-- 20260907065427_add_hardware_section for why (pre-existing Prisma
-- migration drift makes `prisma migrate dev` unsafe against this database).
-- New products auto-created from a purchase item were getting salePrice
-- silently set equal to unitPrice (the purchase/cost price) — zero margin,
-- with no way to enter a real selling price at purchase time. This column
-- lets the purchase form capture one; nullable so old rows (and anyone who
-- leaves it blank) fall back to unitPrice, same as before.
ALTER TABLE "PurchaseItem" ADD COLUMN IF NOT EXISTS "salePrice" DOUBLE PRECISION;
