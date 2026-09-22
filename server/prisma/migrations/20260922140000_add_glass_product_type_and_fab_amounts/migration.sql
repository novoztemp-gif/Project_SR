-- Adds Product.productType (nullable free text: 'glass' | 'plywood' |
-- 'other') so the app can tell a literal glass product apart from
-- plywood/other now that Glass and Plywood share one merged Section —
-- needed for stock-by-sqft, fabrication-details visibility, and pricing
-- rules that only apply to glass.
--
-- Also adds SalesItem.polishAmt / holeAmt / artAmt (nullable) — glass-only
-- cost components added on top of sqFt x unitPrice, entered separately so
-- the bill can show a Glass/Polish/Hole/Art price breakdown.
--
-- Purely additive — no existing rows change.
--
-- Note: this project's migration history has pre-existing drift from the
-- actual database (present before this change), so this was applied
-- directly rather than via `prisma migrate dev`. This file documents what
-- was run, matching the existing schema — see
-- 20260907065427_add_hardware_section for the same pattern.
ALTER TABLE "Product" ADD COLUMN "productType" TEXT;
ALTER TABLE "SalesItem" ADD COLUMN "polishAmt" DOUBLE PRECISION;
ALTER TABLE "SalesItem" ADD COLUMN "holeAmt" DOUBLE PRECISION;
ALTER TABLE "SalesItem" ADD COLUMN "artAmt" DOUBLE PRECISION;
