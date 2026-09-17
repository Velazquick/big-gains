-- Operational release metadata only; no schema/Auth/RLS/user-data changes.
insert into private.product_releases (release)
values ('v117-pwa-update-safety-gate')
on conflict (release) do nothing;
