-- A private preview can also be listed publicly as a clearly labeled example: it shows in search,
-- the feed and the map with an "Example" label, but its deals still can't be claimed or followed.
-- Claiming the page turns it into a normal business.
alter table public.businesses add column if not exists listed_as_example boolean not null default false;
