# Applying Row Level Security (RLS) Policies

This guide explains how to apply the RLS policies to your Supabase database.

## Prerequisites

- Database schema must be created first (run `schema.sql`)
- You must have admin access to your Supabase project

## Steps to Apply RLS Policies

### Option 1: Using Supabase SQL Editor (Recommended)

1. **Open Supabase Dashboard**
   - Go to your project at https://supabase.com
   - Navigate to the SQL Editor

2. **Run the RLS Policies Script**
   - Open `rls_policies.sql` in your text editor
   - Copy the entire contents
   - Paste into the Supabase SQL Editor
   - Click "Run" to execute

3. **Verify RLS is Enabled**
   ```sql
   -- Check which tables have RLS enabled
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public' 
   ORDER BY tablename;
   ```
   
   All tables should show `rowsecurity = true`

4. **Verify Policies Exist**
   ```sql
   -- List all RLS policies
   SELECT schemaname, tablename, policyname, permissive, roles, cmd
   FROM pg_policies
   WHERE schemaname = 'public'
   ORDER BY tablename, policyname;
   ```

### Option 2: Using psql Command Line

```bash
# Connect to your database
psql -h your-db-host -U postgres -d postgres

# Run the RLS policies script
\i backend/database/rls_policies.sql

# Verify
\d+ users
```

### Option 3: Using Supabase CLI

```bash
# Make sure you're in the backend directory
cd backend

# Apply the migration
supabase db push

# Or manually run the script
psql -h localhost -p 54322 -U postgres -d postgres -f database/rls_policies.sql
```

## What the RLS Policies Do

### User Data Protection

- **Users Table**: Users can only read their own record; admins can read all
- **Usage Counters**: Users can only read their own usage; admins can read all
- **Documents**: Users can only access their own documents
- **Chat Sessions**: Users can only access their own chat sessions
- **Messages**: Users can only access messages in their own chat sessions
- **Embeddings**: Users can only access embeddings for their own documents

### Admin-Only Tables

These tables are completely restricted to admin users only:
- `admin_allowlist`
- `api_keys`
- `provider_health`
- `system_flags`
- `audit_logs`

### Service Role Access

The backend service (using the service role key) can bypass RLS for:
- Inserting usage counters
- Inserting messages (AI responses)
- Inserting embeddings (document processing)
- Inserting audit logs
- Managing subscriptions and payments

## Testing RLS Policies

### Test as Regular User

```sql
-- Set the JWT to simulate a regular user
SET request.jwt.claims TO '{"sub": "user-uuid-here"}';

-- Try to read own data (should work)
SELECT * FROM users WHERE id = 'user-uuid-here';

-- Try to read other user's data (should return empty)
SELECT * FROM users WHERE id = 'other-user-uuid';

-- Try to read admin table (should return empty)
SELECT * FROM api_keys;
```

### Test as Admin User

```sql
-- First, add yourself to admin_allowlist
INSERT INTO admin_allowlist (email, role) 
VALUES ('your-email@example.com', 'super_admin');

-- Set the JWT to simulate an admin user
SET request.jwt.claims TO '{"sub": "admin-uuid-here", "email": "your-email@example.com"}';

-- Try to read all users (should work)
SELECT * FROM users;

-- Try to read admin tables (should work)
SELECT * FROM api_keys;
SELECT * FROM admin_allowlist;
```

## Troubleshooting

### Issue: "permission denied for table X"

This means RLS is working correctly and blocking unauthorized access. If you're using the service role key in your backend, this is expected behavior for regular users.

### Issue: Admin cannot access admin tables

1. Verify the admin email is in `admin_allowlist`:
   ```sql
   SELECT * FROM admin_allowlist WHERE email = 'your-email@example.com';
   ```

2. Verify the `is_admin()` function exists:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'is_admin';
   ```

3. Check if RLS is enabled:
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'api_keys';
   ```

### Issue: Backend service cannot insert data

Make sure you're using the **service role key** (not the anon key) in your backend. The service role key bypasses RLS.

In your `.env` file:
```
SUPABASE_SERVICE_KEY=your-service-role-key-here
```

### Issue: Need to disable RLS temporarily

```sql
-- Disable RLS on a specific table (not recommended for production)
ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;

-- Re-enable it
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

## Security Best Practices

1. **Always use service role key in backend**: Never expose it to the frontend
2. **Use anon key in frontend**: This key respects RLS policies
3. **Test RLS policies thoroughly**: Verify users cannot access other users' data
4. **Add yourself to admin_allowlist**: Set up at least one super_admin
5. **Set SUPER_ADMIN_EMAIL**: This provides emergency admin access
6. **Monitor audit logs**: Track all admin actions

## Next Steps

After applying RLS policies:

1. ✅ Verify all tables have RLS enabled
2. ✅ Add your email to `admin_allowlist`
3. ✅ Set `SUPER_ADMIN_EMAIL` in backend `.env`
4. ✅ Test user access (should only see own data)
5. ✅ Test admin access (should see all data)
6. ✅ Configure backend to use service role key
7. ✅ Configure frontend to use anon key

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- Requirements: 23.4, 23.5

