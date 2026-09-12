-- Documentation only: NOT registered in the _prisma_migrations tracking
-- table, applied directly via a one-off script instead — see
-- 20260907065427_add_hardware_section for why (pre-existing Prisma
-- migration drift makes `prisma migrate dev` unsafe against this database).
-- Glass/plywood-only fabrication option columns — nullable since the set of
-- allowed values per field is still being defined.
ALTER TABLE "SalesItem" ADD COLUMN IF NOT EXISTS "arch" TEXT;
ALTER TABLE "SalesItem" ADD COLUMN IF NOT EXISTS "polishSide" TEXT;
ALTER TABLE "SalesItem" ADD COLUMN IF NOT EXISTS "polishName" TEXT;
ALTER TABLE "SalesItem" ADD COLUMN IF NOT EXISTS "cornerType" TEXT;
ALTER TABLE "SalesItem" ADD COLUMN IF NOT EXISTS "hole" TEXT;
ALTER TABLE "SalesItem" ADD COLUMN IF NOT EXISTS "artWork" TEXT;
