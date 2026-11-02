-- Release registration only; hosted application requires separate authorization.
insert into private.product_releases(release) values ('v122-workout-integrity-3a') on conflict do nothing;
