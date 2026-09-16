-- Documentation only: NOT registered in the _prisma_migrations tracking
-- table, applied directly via a one-off script instead — see
-- 20260907065427_add_hardware_section for why (pre-existing Prisma
-- migration drift makes `prisma migrate dev` unsafe against this database).
-- Editable per-row "S.No" label on bill/purchase line items — nullable so
-- existing rows (which never had one) just fall back to their row position
-- when displayed/printed.
ALTER TABLE "SalesItem" ADD COLUMN IF NOT EXISTS "serialNumber" TEXT;
ALTER TABLE "PurchaseItem" ADD COLUMN IF NOT EXISTS "serialNumber" TEXT;
