-- Delete old API keys with encryption issues
DELETE FROM public.api_keys;

-- Add the new Gemini API key
-- Note: You need to encrypt this key first using the admin panel
-- This is just a placeholder - use the admin panel to add the key properly

-- To add via admin panel:
-- 1. Go to http://localhost:3000/admin
-- 2. Click "API Keys" tab
-- 3. Click "Add API Key"
-- 4. Provider: gemini
-- 5. Feature: chat
-- 6. API Key: API_KEY_HERE
-- 7. Priority: 100
-- 8. Click "Add Key"

SELECT 'Old keys deleted. Please add new key via admin panel.' as status;
