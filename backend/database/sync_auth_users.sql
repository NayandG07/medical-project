-- Sync Supabase Auth users to custom users table
-- Run this in Supabase SQL Editor

-- Insert users from auth.users into public.users if they don't exist
INSERT INTO public.users (id, email, name, plan, created_at, updated_at)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'name', au.email) as name,
    'free' as plan,
    au.created_at,
    au.updated_at
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM public.users pu WHERE pu.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- Show synced users
SELECT 
    u.id,
    u.email,
    u.name,
    u.plan,
    u.created_at
FROM public.users u
ORDER BY u.created_at DESC;
