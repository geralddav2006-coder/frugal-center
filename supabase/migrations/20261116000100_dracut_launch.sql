-- Launch market: Dracut, MA and the towns right around it (Eastern time).
-- Customers can pick any of these as their location; businesses in these ZIPs
-- are placed on the map from the ZIP until they drop a pin.
delete from public.launch_areas;

insert into public.launch_areas (zip, neighborhood, city, state, lat, lng) values
  ('01826', 'Dracut', 'Dracut', 'MA', 42.6708, -71.3028),
  ('01850', 'Centralville', 'Lowell', 'MA', 42.6553, -71.3045),
  ('01854', 'Pawtucketville', 'Lowell', 'MA', 42.6612, -71.3357),
  ('01879', 'Tyngsborough', 'Tyngsborough', 'MA', 42.6671, -71.4245),
  ('01844', 'Methuen', 'Methuen', 'MA', 42.7262, -71.1909),
  ('03076', 'Pelham', 'Pelham', 'NH', 42.7348, -71.3245);

alter table public.businesses alter column timezone set default 'America/New_York';
update public.businesses set timezone = 'America/New_York' where timezone = 'America/Chicago';
