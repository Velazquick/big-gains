-- Register the browser release; no user records or schema changes.
insert into private.product_releases(release) values ('v119-conflict-resolution-retry') on conflict do nothing;
