alter table public.stock_motorcycles
add column if not exists stock_branch_code text,
add column if not exists stock_branch_name text,
add column if not exists created_by_staff_email text,
add column if not exists sent_to_center_at timestamptz,
add column if not exists stock_remark text,
add column if not exists missing_detail_remark text;

alter table public.stock_motorcycles
add column if not exists stock_status text default 'branch_stock';

create index if not exists stock_motorcycles_stock_branch_code_idx
on public.stock_motorcycles (stock_branch_code);
