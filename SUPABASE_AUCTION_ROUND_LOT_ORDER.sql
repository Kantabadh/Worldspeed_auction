alter table auction_round_lots
  add column if not exists sort_order integer;

alter table auction_round_lots
  add column if not exists round_lot_number text;

alter table auction_round_lots
  add column if not exists stock_motorcycle_id bigint;
