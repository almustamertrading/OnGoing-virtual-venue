-- Synthetic rows for the RBAC data-move check (scripts/db/check-rbac-backfill.sh).
-- Loaded into the LOCAL database at migration 20261109160000, before the RBAC
-- migration runs. Reserved .test domains only; no production data.

insert into public.organizations (id, name, email_domain)
values ('a0000000-0000-4000-8000-00000000000a', 'QA Org A', 'qa-a.test');
insert into public.organization_domains (domain, organization_id)
values ('qa-a.test', 'a0000000-0000-4000-8000-00000000000a');

-- The first user on the domain becomes admin, the second staff (promoted to manager below).
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-0000000000a1',
   'authenticated', 'authenticated', 'admin@qa-a.test', now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-0000000000a2',
   'authenticated', 'authenticated', 'manager@qa-a.test', now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now());

update public.organization_members set role = 'manager'
where user_id = 'a0000000-0000-4000-8000-0000000000a2';

insert into public.proposals (id, organization_id, title, created_by)
values ('a0000000-0000-4000-8000-0000000000b1', 'a0000000-0000-4000-8000-00000000000a',
        'QA proposal', 'a0000000-0000-4000-8000-0000000000a1');

insert into public.proposal_items (id, proposal_id, organization_id, description, quantity,
  unit_cost, unit_price, created_by, updated_at)
values
  ('a0000000-0000-4000-8000-0000000000c1', 'a0000000-0000-4000-8000-0000000000b1',
   'a0000000-0000-4000-8000-00000000000a', 'Stage', 1, 100.00, 180.00,
   'a0000000-0000-4000-8000-0000000000a1', '2026-01-01 10:00:00+00'),
  ('a0000000-0000-4000-8000-0000000000c2', 'a0000000-0000-4000-8000-0000000000b1',
   'a0000000-0000-4000-8000-00000000000a', 'Free item', 1, 0, 50.00,
   'a0000000-0000-4000-8000-0000000000a1', '2026-01-01 10:00:00+00'),
  ('a0000000-0000-4000-8000-0000000000c3', 'a0000000-0000-4000-8000-0000000000b1',
   'a0000000-0000-4000-8000-00000000000a', 'Lighting', 2, 250.50, 400.00,
   'a0000000-0000-4000-8000-0000000000a1', '2026-01-01 10:00:00+00');

insert into public.inventory_items (id, organization_id, name, quantity, unit_rate, created_by, updated_at)
values
  ('a0000000-0000-4000-8000-0000000000d1', 'a0000000-0000-4000-8000-00000000000a',
   'Chairs', 100, 40.00, 'a0000000-0000-4000-8000-0000000000a1', '2026-01-01 10:00:00+00'),
  ('a0000000-0000-4000-8000-0000000000d2', 'a0000000-0000-4000-8000-00000000000a',
   'Tables', 10, null, 'a0000000-0000-4000-8000-0000000000a1', '2026-01-01 10:00:00+00'),
  ('a0000000-0000-4000-8000-0000000000d3', 'a0000000-0000-4000-8000-00000000000a',
   'Donated banner', 1, 0, 'a0000000-0000-4000-8000-0000000000a1', '2026-01-01 10:00:00+00');
