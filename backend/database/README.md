# Database Setup Guide

This directory contains the database schema and migration files for the Medical AI Platform.

## Prerequisites

- Supabase account (cloud) or local Supabase installation
- PostgreSQL client (psql) or Supabase SQL Editor

## Setup Instructions

### Option 1: Using Supabase Cloud (Recommended for Development)

1. **Create a Supabase Project**
   - Go to [https://supabase.com](https://supabase.com)
   - Create a new project
   - Note your project URL and API keys

2. **Run the Schema Migration**
   - Open the Supabase SQL Editor in your project dashboard
   - Copy the contents of `schema.sql`
   - Paste and execute in the SQL Editor
   - Verify all tables are created successfully

3. **Set Up RLS Policies**
   - After schema creation, run `rls_policies.sql`
   - Copy the contents of `rls_policies.sql`
   - Paste and execute in the SQL Editor
   - This enables Row Level Security for data protection
   - Verify RLS is enabled: `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;`

4. **Configure Environment Variables**
   - Copy `backend/.env.example` to `backend/.env`
   - Add your Supabase URL and keys:
     ```
     SUPABASE_URL=your_project_url
     SUPABASE_KEY=your_anon_key
     SUPABASE_SERVICE_KEY=your_service_role_key
     SUPER_ADMIN_EMAIL=your_email@example.com
     ```

### Option 2: Using Local Supabase

1. **Install Supabase CLI**
   ```bash
   npm install -g supabase
   ```

2. **Initialize Supabase**
   ```bash
   cd backend
   supabase init
   ```

3. **Start Local Supabase**
   ```bash
   supabase start
   ```

4. **Run Migrations**
   ```bash
   supabase db reset
   # Or manually run schema.sql
   psql -h localhost -p 54322 -U postgres -d postgres -f database/schema.sql
   ```

### Option 3: Using PostgreSQL Directly

If you prefer to use a standalone PostgreSQL database:

```bash
psql -U your_username -d your_database -f database/schema.sql
```

## Database Schema Overview

### Core Tables

- **users**: User accounts with plan (free/student/pro/admin) and role
- **admin_allowlist**: Whitelist of admin users
- **usage_counters**: Daily usage tracking for rate limiting
- **api_keys**: Pool of API keys with priority and health status
- **provider_health**: Health check history for API keys
- **system_flags**: Feature toggles and maintenance mode flags

### Document & RAG Tables

- **documents**: User-uploaded PDFs and images
- **embeddings**: Vector embeddings for semantic search (pgvector)

### Chat Tables

- **chat_sessions**: Conversation sessions
- **messages**: Individual messages with citations

### Payment Tables

- **subscriptions**: User subscription records
- **payments**: Payment transaction history

### Audit Tables

- **audit_logs**: Admin action audit trail

## Verification

After running the schema, verify the setup:

```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check extensions are enabled
SELECT * FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgvector');

-- Check indexes
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;
```

## Next Steps

1. Run RLS policies (Task 3)
2. Create initial admin user in admin_allowlist
3. Set SUPER_ADMIN_EMAIL in environment variables
4. Test database connection from backend application

## Troubleshooting

### pgvector Extension Not Found

If you get an error about pgvector:
- For Supabase Cloud: pgvector is pre-installed
- For local PostgreSQL: Install pgvector extension
  ```bash
  # Ubuntu/Debian
  sudo apt-get install postgresql-14-pgvector
  
  # macOS with Homebrew
  brew install pgvector
  ```

### Permission Errors

Ensure your database user has sufficient privileges:
```sql
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user;
```

### Connection Issues

Check your connection string format:
```
postgresql://user:password@host:port/database
```

For Supabase, use the connection pooler URL for production.
