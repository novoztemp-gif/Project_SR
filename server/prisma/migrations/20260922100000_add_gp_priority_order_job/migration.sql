-- Adds priority (raw 'H'/'M'/'L' text), orderNumber and jobDescription to
-- SalesBill — Glass & Plywood billing only (general bills leave them null).
-- Purely additive, no existing rows change.
--
-- Note: this project's migration history has pre-existing drift from the
-- actual database (present before this change), so this was applied
-- directly rather than via `prisma migrate dev`. This file documents what
-- was run, matching the existing schema — see
-- 20260907065427_add_hardware_section for the same pattern.
ALTER TABLE "SalesBill" ADD COLUMN "priority" TEXT;
ALTER TABLE "SalesBill" ADD COLUMN "orderNumber" TEXT;
ALTER TABLE "SalesBill" ADD COLUMN "jobDescription" TEXT;
