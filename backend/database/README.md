# Database Setup

## Files

| File | Purpose | Required? |
|------|---------|-----------|
| `schema.sql` | Creates all tables and indexes | **YES** |
| `rls_policies.sql` | Row Level Security policies | Optional (backend uses service_role) |

## Setup Instructions

### Step 1: Run schema.sql
1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `schema.sql`
3. Click "Run"

### Step 2: (Optional) Run rls_policies.sql
Only needed if you want RLS protection. The backend uses `service_role` key which bypasses RLS anyway.

## That's it!

The backend will automatically:
- Create users in `public.users` when they register
- Check `SUPER_ADMIN_EMAIL` env var for admin access
- Use the `admin_allowlist` table for additional admins
