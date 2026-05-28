-- Run this in Supabase SQL Editor if archive history misses sold/unsold lots.
-- It archives by motorcycles.auction_round_id and offers.auction_round_id,
-- without filtering motorcycles.active.

create or replace function archive_current_auction(
  p_email text default null,
  p_role text default null,
  p_note text default null
)
returns table (
  round_id bigint,
  round_name text,
  archived_lot_count integer,
  archived_offer_count integer
)
language plpgsql
security definer
as $$
declare
  v_round_id bigint;
  v_round_name text;
begin
  select id, coalesce(auction_rounds.round_name, 'Auction Round #' || id::text)
    into v_round_id, v_round_name
  from auction_rounds
  where is_current = true
  order by id desc
  limit 1;

  if v_round_id is null then
    raise exception 'No current auction round found';
  end if;

  delete from auction_round_offers
  where auction_round_id = v_round_id;

  delete from auction_round_lots
  where auction_round_id = v_round_id;

  with ranked_offers as (
    select
      o.id as offer_id,
      o.auction_round_id,
      o.merchant_id,
      o.motorcycle_id,
      o.offer_price,
      o.submitted_at,
      o.was_edited,
      o.original_offer_price,
      o.updated_at,
      m.name as merchant_name,
      m.shop_name,
      m.phone,
      dense_rank() over (
        partition by o.motorcycle_id
        order by o.offer_price desc
      ) as offer_rank
    from offers o
    left join merchants m on m.id = o.merchant_id
    where o.auction_round_id = v_round_id
  ),
  lot_summary as (
    select
      motorcycle_id,
      max(offer_price) as highest_offer,
      max(offer_price) filter (where offer_rank = 1) as winner_price,
      string_agg(shop_name || ' ' || coalesce(offer_price, 0)::text, ', ')
        filter (where offer_rank = 2) as second_place_text
    from ranked_offers
    group by motorcycle_id
  ),
  winners as (
    select distinct on (motorcycle_id)
      motorcycle_id,
      shop_name,
      merchant_name,
      phone,
      offer_price
    from ranked_offers
    where offer_rank = 1
    order by motorcycle_id, offer_price desc, offer_id asc
  )
  insert into auction_round_lots (
    auction_round_id,
    original_motorcycle_id,
    lot_number,
    motorcycle_name,
    cost_price,
    brand,
    model,
    year,
    license_plate,
    frame_number,
    engine_number,
    purchase_date,
    acquisition_type,
    source_name,
    highest_offer,
    winner_shop_name,
    winner_contact_name,
    winner_phone,
    second_place_text,
    diff
  )
  select
    m.auction_round_id,
    m.id,
    m.lot_number,
    m.motorcycle_name,
    m.cost_price,
    m.brand,
    m.model,
    m.year,
    m.license_plate,
    m.frame_number,
    m.engine_number,
    m.purchase_date,
    m.acquisition_type,
    m.source_name,
    ls.highest_offer,
    w.shop_name,
    w.merchant_name,
    w.phone,
    ls.second_place_text,
    coalesce(ls.highest_offer, 0) - coalesce(m.cost_price, 0)
  from motorcycles m
  left join lot_summary ls on ls.motorcycle_id = m.id
  left join winners w on w.motorcycle_id = m.id
  where m.auction_round_id = v_round_id;

  insert into auction_round_offers (
    auction_round_id,
    original_offer_id,
    original_merchant_id,
    original_motorcycle_id,
    lot_number,
    motorcycle_name,
    merchant_name,
    shop_name,
    phone,
    offer_price,
    submitted_at,
    was_edited,
    original_offer_price,
    updated_at
  )
  select
    o.auction_round_id,
    o.id,
    o.merchant_id,
    o.motorcycle_id,
    mc.lot_number,
    mc.motorcycle_name,
    m.name,
    m.shop_name,
    m.phone,
    o.offer_price,
    o.submitted_at,
    o.was_edited,
    o.original_offer_price,
    o.updated_at
  from offers o
  left join motorcycles mc on mc.id = o.motorcycle_id
  left join merchants m on m.id = o.merchant_id
  where o.auction_round_id = v_round_id;

  update auction_rounds
  set
    status = 'archived',
    archived_at = now(),
    archived_by_email = p_email,
    archived_by_role = p_role,
    total_lots = (
      select count(*) from motorcycles
      where auction_round_id = v_round_id
    ),
    total_merchants = (
      select count(distinct merchant_id) from offers
      where auction_round_id = v_round_id
    ),
    total_offers = (
      select count(*) from offers
      where auction_round_id = v_round_id
    ),
    total_highest_offer = (
      select coalesce(sum(highest_offer), 0)
      from (
        select max(offer_price) as highest_offer
        from offers
        where auction_round_id = v_round_id
        group by motorcycle_id
      ) highest_by_lot
    ),
    total_cost = (
      select coalesce(sum(cost_price), 0) from motorcycles
      where auction_round_id = v_round_id
    ),
    total_gross_profit = (
      select coalesce(sum(coalesce(l.highest_offer, 0) - coalesce(m.cost_price, 0)), 0)
      from motorcycles m
      left join (
        select motorcycle_id, max(offer_price) as highest_offer
        from offers
        where auction_round_id = v_round_id
        group by motorcycle_id
      ) l on l.motorcycle_id = m.id
      where m.auction_round_id = v_round_id
    ),
    note = p_note
  where id = v_round_id;

  return query
  select
    v_round_id,
    v_round_name,
    (select count(*)::integer from auction_round_lots where auction_round_id = v_round_id),
    (select count(*)::integer from auction_round_offers where auction_round_id = v_round_id);
end;
$$;
