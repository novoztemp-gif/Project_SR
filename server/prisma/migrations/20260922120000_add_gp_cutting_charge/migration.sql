-- Adds cuttingCharge (default 0) to SalesBill — Glass & Plywood billing
-- only (general bills leave it at the default). Purely additive, no
-- existing rows change meaning.
--
-- Note: this project's migration history has pre-existing drift from the
-- actual database (present before this change), so this was applied
-- directly rather than via `prisma migrate dev`. This file documents what
-- was run, matching the existing schema — see
-- 20260907065427_add_hardware_section for the same pattern.
ALTER TABLE "SalesBill" ADD COLUMN "cuttingCharge" DOUBLE PRECISION NOT NULL DEFAULT 0;
