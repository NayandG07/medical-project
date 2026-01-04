# Admin Panel API Key Management - Database Consistency Fix

## Summary
Fixed inconsistencies between the admin panel's "Add API Key" form and the Supabase database schema to ensure all database fields are properly supported.

## Database Schema (api_keys table)
The database has the following fields:
- `id` (UUID) - Primary key
- `provider` (TEXT) - Provider name
- `feature` (TEXT) - Feature name
- `key_value` (TEXT) - Encrypted API key
- `priority` (INTEGER) - Priority level (0-100)
- `status` (TEXT) - Status: 'active', 'degraded', or 'disabled'
- `failure_count` (INTEGER) - Number of failures
- `last_used_at` (TIMESTAMPTZ) - Last usage timestamp
- `created_at` (TIMESTAMPTZ) - Creation timestamp
- `updated_at` (TIMESTAMPTZ) - Update timestamp

## Changes Made

### 1. Frontend - AddApiKeyForm Component
**File:** `frontend/components/AddApiKeyForm.tsx`

**Added:**
- Status field selection (active, degraded, disabled) with default 'active'
- All feature types: chat, flashcard, mcq, image, embedding, highyield, explain, map, clinical, osce
- All provider types: gemini, openai, anthropic, openrouter, ollama
- Updated form submission to include status parameter

### 2. Frontend - API Keys Page
**File:** `frontend/pages/admin/api-keys.tsx`

**Updated:**
- Provider filter to include all providers (gemini, openai, anthropic, openrouter, ollama)
- handleAddKey function to pass status parameter to backend

### 3. Backend - API Models
**File:** `backend/main.py`

**Updated:**
- `AddApiKeyRequest` model to include optional `status` field (default: "active")
- `UpdateKeyStatusRequest` model to include optional `priority` field for updates
- API endpoint to pass status to admin service
- Update endpoint to pass priority to admin service

### 4. Backend - Admin Service
**File:** `backend/services/admin.py`

**Updated:**
- `add_api_key()` function to accept and validate status parameter
- `update_key_status()` function to accept and update priority parameter
- Status validation to ensure only valid values ('active', 'degraded', 'disabled')
- Audit logging to include status and priority changes

## Features Now Supported

### Providers
1. Gemini
2. OpenAI
3. Anthropic
4. OpenRouter
5. Ollama

### Features
1. Chat
2. Flashcard
3. MCQ
4. Image
5. Embedding
6. High Yield
7. Explain
8. Map
9. Clinical
10. OSCE

### Status Options
1. Active - Key is fully operational
2. Degraded - Key has issues but still usable
3. Disabled - Key is not in use

## Benefits

1. **Complete Database Consistency** - All database fields are now accessible through the admin panel
2. **Initial Status Control** - Admins can set the initial status when adding keys (not just default to 'active')
3. **Priority Updates** - Admins can now update priority after key creation
4. **All Features Available** - All 10 feature types are now selectable
5. **All Providers Available** - All 5 providers are now selectable
6. **Better Audit Trail** - Status and priority changes are logged in audit logs

## Testing Recommendations

1. Test adding a new API key with different status values
2. Test updating priority through the admin panel
3. Verify all providers and features are selectable
4. Check audit logs include status and priority information
5. Verify status validation rejects invalid values
