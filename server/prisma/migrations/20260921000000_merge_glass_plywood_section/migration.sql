-- Merges the "glass" and "plywood" Section enum values into a single
-- "glass_plywood" value, and rewrites every existing row (Product,
-- SalesBill, PurchaseBill, and User.processes) that referenced either of
-- the old values. Glass and Plywood already shared one billing flow and
-- one set of counter permissions in practice — this collapses the
-- underlying category to match, everywhere: inventory, purchases, and
-- Counter Management's per-staff process list.
--
-- Note: this project's migration history has pre-existing drift from the
-- actual database (present before this change), so this was applied
-- directly rather than via `prisma migrate dev`. This file documents what
-- was run, matching the existing schema. See the "hardware" section
-- migration (20260907065427_add_hardware_section) for the same pattern.
--
-- Postgres can't drop enum values without recreating the type, so "glass"
-- and "plywood" stay defined-but-unused in the physical Section enum after
-- this runs. Nothing in the application ever writes them again.
ALTER TYPE "Section" ADD VALUE IF NOT EXISTS 'glass_plywood';

UPDATE "Product" SET section = 'glass_plywood' WHERE section IN ('glass', 'plywood');
UPDATE "SalesBill" SET section = 'glass_plywood' WHERE section IN ('glass', 'plywood');
UPDATE "PurchaseBill" SET section = 'glass_plywood' WHERE section IN ('glass', 'plywood');

-- Dedupes: a counter previously granted both "glass" and "plywood" ends up
-- with a single "glass_plywood" entry, not two.
UPDATE "User" SET processes = ARRAY(
  SELECT DISTINCT CASE WHEN e IN ('glass', 'plywood') THEN 'glass_plywood'::"Section" ELSE e END
  FROM unnest(processes) AS e
) WHERE 'glass' = ANY(processes) OR 'plywood' = ANY(processes);
