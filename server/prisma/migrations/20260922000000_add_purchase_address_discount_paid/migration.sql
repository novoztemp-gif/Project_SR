-- Adds vendorAddress (nullable free text), discount and paidAmount
-- (both default 0) to PurchaseBill, mirroring the discount/paidAmount
-- concept SalesBill already has, plus a new vendor address field for the
-- purchase voucher printout. Purely additive — no existing rows change
-- meaning (discount/paidAmount default to 0, same as today's implicit
-- behavior of neither existing at all).
--
-- Note: this project's migration history has pre-existing drift from the
-- actual database (present before this change), so this was applied
-- directly rather than via `prisma migrate dev`. This file documents what
-- was run, matching the existing schema — see
-- 20260907065427_add_hardware_section for the same pattern.
ALTER TABLE "PurchaseBill" ADD COLUMN "vendorAddress" TEXT;
ALTER TABLE "PurchaseBill" ADD COLUMN "discount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PurchaseBill" ADD COLUMN "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
