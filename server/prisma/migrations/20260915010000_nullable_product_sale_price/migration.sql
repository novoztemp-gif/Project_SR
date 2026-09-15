-- Documentation only: NOT registered in the _prisma_migrations tracking
-- table, applied directly via a one-off script instead — see
-- 20260907065427_add_hardware_section for why (pre-existing Prisma
-- migration drift makes `prisma migrate dev` unsafe against this database).
--
-- Product.salePrice becomes nullable: null now means "no selling price has
-- been explicitly set" (shown as an "Add selling price" action), rather
-- than always holding a number that might silently be the cost price in
-- disguise.
ALTER TABLE "Product" ALTER COLUMN "salePrice" DROP NOT NULL;

-- One-time data cleanup: every existing product whose salePrice exactly
-- equals its costPrice got that way from the exact bug this change fixes
-- (a purchase-created product defaulted to zero margin, with no field to
-- even notice it) — not a deliberately-priced item that happens to have no
-- markup. Reset those to "not set" so they show the new Add-selling-price
-- action instead of silently continuing to bill customers at cost.
-- Products whose salePrice already differs from costPrice (a real,
-- deliberately entered price) are left untouched.
UPDATE "Product" SET "salePrice" = NULL WHERE "salePrice" = "costPrice";
