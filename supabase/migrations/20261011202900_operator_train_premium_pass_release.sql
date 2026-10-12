-- Register Train Premium Pass 01 for release telemetry; no user rows or schema changes.
insert into private.product_releases(release) values ('v120-train-premium-pass-01') on conflict do nothing;
