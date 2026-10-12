-- Release registry only; apply to hosted state only with separate authorization.
insert into private.product_releases(release) values ('v121-train-premium-pass-02') on conflict do nothing;
