# Security TODO

Current security is still prototype-level. `StaffGuard` now covers admin pages, but many pages still read and write Supabase directly from browser client components.

## Current Guard Coverage

- `/admin`: `StaffGuard`, owner/admin by default. Stock staff is redirected to `/admin/stock` by page logic.
- `/admin/stock`: `StaffGuard allowedRoles={["owner", "admin", "stock_staff"]}`.
- `/admin/motorcycles`: `StaffGuard`, owner/admin by default.
- `/admin/lots/[id]`: `StaffGuard`, owner/admin by default.
- `/admin/merchants`: `StaffGuard`, owner/admin by default.
- `/admin/merchant-receipts`: `StaffGuard`, owner/admin by default.
- `/admin/history`: `StaffGuard`, owner/admin by default.
- `/admin/rounds`: `StaffGuard`, owner/admin by default.
- `/admin/sold`: `StaffGuard`, owner/admin by default.
- `/admin/unsold`: `StaffGuard`, owner/admin by default.
- `/admin/audit-logs`: `StaffGuard`, owner/admin by default.
- `/admin/staff`: `StaffGuard allowedRoles={["owner"]}`.

## Dangerous Actions

- Reset auction: UI and logic require `owner`.
- Archive auction: UI and logic require `owner`.
- Staff management: route is owner-only through `StaffGuard`.
- Stock staff: allowed only on `/admin/stock`.

## Hardening Plan

1. Move dangerous writes to server-side API routes:
   - reset auction
   - archive auction
   - mark sold
   - mark unsold
   - create/update auction rounds
   - approve/reject merchants
   - staff management
2. Use Supabase service role only on the server. Never expose service role keys to browser code.
3. Enable RLS table by table after server routes exist.
4. Add explicit RLS policies for:
   - merchant accounts
   - merchant submissions
   - offers
   - motorcycles
   - stock motorcycles
   - sold/unsold archives
   - auction history tables
   - audit logs
5. Re-test every route after each table's RLS is enabled.

Do not enable strict RLS globally until the write paths above are moved server-side.
