-- Adds "writtenStaff" (nullable free text) to SalesBill and PurchaseBill —
-- the name of the staff member who physically wrote the bill, distinct from
-- createdBy (the counter/login account that entered it). Purely additive —
-- no existing rows change.
--
-- Note: this project's migration history has pre-existing drift from the
-- actual database (present before this change), so this was applied
-- directly rather than via `prisma migrate dev`. This file documents what
-- was run, matching the existing schema — see
-- 20260907065427_add_hardware_section for the same pattern.
ALTER TABLE "SalesBill" ADD COLUMN "writtenStaff" TEXT;
ALTER TABLE "PurchaseBill" ADD COLUMN "writtenStaff" TEXT;
