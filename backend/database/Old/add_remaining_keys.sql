-- Add missing feature keys by copying from the chat key
-- Run this in Supabase SQL Editor

-- First, let's see what we have
SELECT provider, feature, status FROM api_keys WHERE provider = 'openai' ORDER BY feature;

-- Now add the missing ones (only if they don't exist)
-- Get the chat key value and use it for all missing features

-- Add highyield if it doesn't exist
INSERT INTO api_keys (provider, feature, key_value, priority, status)
SELECT 
    'openai' as provider,
    'highyield' as feature,
    key_value,
    100 as priority,
    'active' as status
FROM api_keys 
WHERE provider = 'openai' AND feature = 'chat' AND status = 'active'
AND NOT EXISTS (
    SELECT 1 FROM api_keys WHERE provider = 'openai' AND feature = 'highyield'
)
LIMIT 1;

-- Add explain if it doesn't exist
INSERT INTO api_keys (provider, feature, key_value, priority, status)
SELECT 
    'openai' as provider,
    'explain' as feature,
    key_value,
    100 as priority,
    'active' as status
FROM api_keys 
WHERE provider = 'openai' AND feature = 'chat' AND status = 'active'
AND NOT EXISTS (
    SELECT 1 FROM api_keys WHERE provider = 'openai' AND feature = 'explain'
)
LIMIT 1;

-- Add map if it doesn't exist
INSERT INTO api_keys (provider, feature, key_value, priority, status)
SELECT 
    'openai' as provider,
    'map' as feature,
    key_value,
    100 as priority,
    'active' as status
FROM api_keys 
WHERE provider = 'openai' AND feature = 'chat' AND status = 'active'
AND NOT EXISTS (
    SELECT 1 FROM api_keys WHERE provider = 'openai' AND feature = 'map'
)
LIMIT 1;

-- Add clinical if it doesn't exist
INSERT INTO api_keys (provider, feature, key_value, priority, status)
SELECT 
    'openai' as provider,
    'clinical' as feature,
    key_value,
    100 as priority,
    'active' as status
FROM api_keys 
WHERE provider = 'openai' AND feature = 'chat' AND status = 'active'
AND NOT EXISTS (
    SELECT 1 FROM api_keys WHERE provider = 'openai' AND feature = 'clinical'
)
LIMIT 1;

-- Add osce if it doesn't exist
INSERT INTO api_keys (provider, feature, key_value, priority, status)
SELECT 
    'openai' as provider,
    'osce' as feature,
    key_value,
    100 as priority,
    'active' as status
FROM api_keys 
WHERE provider = 'openai' AND feature = 'chat' AND status = 'active'
AND NOT EXISTS (
    SELECT 1 FROM api_keys WHERE provider = 'openai' AND feature = 'osce'
)
LIMIT 1;

-- Verify all keys are now present
SELECT provider, feature, status, priority FROM api_keys WHERE provider = 'openai' ORDER BY feature;
