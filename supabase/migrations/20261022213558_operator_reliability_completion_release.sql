-- Release registration only; hosted application requires separate authorization.
insert into private.product_releases(release) values ('v123-reliability-completion') on conflict do nothing;
