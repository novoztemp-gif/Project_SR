-- Adds "hardware" as a new value of the Section enum, alongside glass,
-- plywood, plumbing, painting, and electrical. Purely additive — no
-- existing rows or values are affected.
--
-- Note: this project's migration history has pre-existing drift from the
-- actual database (present before this change), so this was applied
-- directly rather than via `prisma migrate dev`. This file documents what
-- was run, matching the existing schema.
ALTER TYPE "Section" ADD VALUE IF NOT EXISTS 'hardware';
