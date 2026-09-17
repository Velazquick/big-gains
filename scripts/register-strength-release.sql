-- Operational release metadata only; no schema/Auth/RLS/user-data changes.
insert into private.product_releases (release)
values ('v116-strength-history-correctness')
on conflict (release) do nothing;
