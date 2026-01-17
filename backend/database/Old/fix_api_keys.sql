-- Fix API Keys - Delete keys with encryption issues
-- Run this in Supabase SQL Editor if you're getting decryption errors

-- Delete all API keys (you'll need to re-add them through the admin panel)
DELETE FROM public.api_keys;

-- Verify deletion
SELECT COUNT(*) as remaining_keys FROM public.api_keys;
