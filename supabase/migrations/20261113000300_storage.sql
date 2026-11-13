-- Public bucket for business logos, cover photos and deal images.
-- Uploads are performed by the server with the service-role key after it has
-- validated file type/size and the uploader's business membership, so no
-- client-side insert policy is granted. Guarded so the local demo database
-- (which has no `storage` schema) can run the same migrations.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('media', 'media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;
  end if;
end $$;
