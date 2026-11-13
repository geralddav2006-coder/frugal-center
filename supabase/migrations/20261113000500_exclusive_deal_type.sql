-- Frugal Center exclusive: a fourth deal type for general promotional discounts
-- (grand openings, seasonal promos, "found us on Frugal Center" offers) that are
-- not surplus stock, canceled appointments or off-peak hours.
-- The new enum value is used by the next migration, which runs in its own transaction.
alter type public.deal_type add value if not exists 'exclusive';
