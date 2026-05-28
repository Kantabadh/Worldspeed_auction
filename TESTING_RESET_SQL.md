# Testing Reset SQL Notes

Use these snippets manually in Supabase SQL Editor during testing only. Do not run them on real production data without a backup.

## 1. Clean Current Auction Only, Keep Accounts And Stock

```sql
delete from merchant_lot_edit_permissions;

delete from offers
where auction_round_id in (
  select id from auction_rounds where is_current = true
);

delete from merchants
where auction_round_id in (
  select id from auction_rounds where is_current = true
);

delete from motorcycle_photos
where motorcycle_id in (
  select id from motorcycles
  where auction_round_id in (select id from auction_rounds where is_current = true)
);

delete from motorcycles
where auction_round_id in (
  select id from auction_rounds where is_current = true
);

update stock_motorcycles
set
  current_auction_motorcycle_id = null,
  current_auction_round_id = null,
  stock_status = case
    when stock_status = 'in_auction' then 'ready_to_sell'
    else stock_status
  end,
  updated_at = now()
where current_auction_round_id in (
  select id from auction_rounds where is_current = true
)
or stock_status = 'in_auction';
```

## 2. Clean All Test Stock And Auction Data, Keep Accounts

```sql
delete from merchant_lot_edit_permissions;
delete from offers;
delete from merchants;
delete from motorcycle_photos;
delete from motorcycles;
delete from stock_motorcycle_photos;
delete from stock_motorcycles;
delete from sold_motorcycles;
delete from unsold_motorcycles;
```

## 3. Clean Archive / History Only

```sql
delete from auction_round_offers;
delete from auction_round_lots;

update auction_rounds
set
  status = 'closed',
  archived_at = null,
  archived_by_email = null,
  archived_by_role = null,
  total_lots = null,
  total_merchants = null,
  total_offers = null,
  total_highest_offer = null,
  total_cost = null,
  total_gross_profit = null,
  note = null
where archived_at is not null;
```

## 4. Clean Sold / Unsold Archive Only

```sql
delete from sold_motorcycles;
delete from unsold_motorcycles;
```

## 5. Browser localStorage Keys To Clear

Clear these in DevTools Console when merchant testing feels stuck:

```js
[
  "draftSubmission",
  "latestSubmission",
  "merchantPageDraft",
  "merchantOfferPrices",
  "merchantSession",
  "merchantStarredLotIds",
  "staffProfile"
].forEach((key) => localStorage.removeItem(key));
```
