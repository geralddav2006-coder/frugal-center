-- Removes the "founding business" badge column added (and then dropped) on 2026-11-20.
alter table public.businesses drop column if exists founding_member;
