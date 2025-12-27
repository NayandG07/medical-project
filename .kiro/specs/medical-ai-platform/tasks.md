# Implementation Plan: Medical AI Platform

## Overview

This implementation plan breaks down the medical AI platform into discrete, incremental coding tasks following the scarcity-first engineering approach. The plan follows the strict development order: Phase 1 (Local Core App) → Phase 2 (Backend Intelligence) → Phase 3 (Admin System) → Phase 4 (API Key Pool & Health) → Phase 5 (System Visual/Guidance) → Phase 6 (Hosting).

Each task builds on previous work, with no orphaned code. All testing tasks are required to ensure comprehensive quality from the start.

## Tasks

### PHASE 1: Local Core App - Foundation

- [x] 1. Set up project structure and development environment
  - Create backend/ directory with FastAPI project structure
  - Create frontend/ directory with Next.js project
  - Set up Python virtual environment and install FastAPI, Supabase client, Hypothesis
  - Set up Node.js project and install Next.js, React, TypeScript
  - Create .env.example files for both backend and frontend
  - Set up .gitignore files
  - _Requirements: 25.1, 25.2, 25.3, 25.5_

- [x] 1.1 Write unit tests for project setup
  - Test environment variable loading
  - Test basic FastAPI app initialization
  - _Requirements: 25.1_

- [x] 2. Set up Supabase database schema
  - Create Supabase project (cloud or local)
  - Create users table with plan and role fields
  - Create admin_allowlist table
  - Create usage_counters table with daily tracking fields
  - Create api_keys table with encryption support
  - Create provider_health table
  - Create system_flags table
  - Create documents, embeddings tables with pgvector
  - Create chat_sessions and messages tables
  - Create subscriptions and payments tables
  - Create audit_logs table
  - _Requirements: 23.2, 23.3_


- [x] 2.1 Write unit tests for database schema
  - Test table creation and constraints
  - Test foreign key relationships
  - _Requirements: 23.2_

- [x] 3. Implement Supabase RLS policies
  - Create RLS policy for users table (users can read own, admins can read all)
  - Create RLS policy for usage_counters (users can read own, admins can read all)
  - Create RLS policy for admin tables (admin-only access)
  - Create RLS policy for documents, embeddings, chat_sessions, messages (user-owned data)
  - Enable RLS on all tables
  - _Requirements: 23.4, 23.5_

- [x] 3.1 Write unit tests for RLS policies
  - Test user can access own data
  - Test user cannot access other user's data
  - Test admin can access all data
  - _Requirements: 23.4_

- [x] 4. Implement authentication service
  - Create services/auth.py with Supabase Auth integration
  - Implement authenticate_user(email, password) function
  - Implement register_user(email, password, name) function with default "free" plan
  - Implement get_user_plan(user_id) function
  - Implement verify_admin(user_id) function with allowlist check
  - Implement emergency admin check via SUPER_ADMIN_EMAIL environment variable
  - _Requirements: 1.1, 1.2, 1.3, 2.2, 2.4_

- [x] 4.1 Write property test for user registration default plan
  - **Property 1: User registration assigns default plan**
  - **Validates: Requirements 1.2**

- [x] 4.2 Write property test for admin access control
  - **Property 2: Admin access requires allowlist and role**
  - **Validates: Requirements 2.2**

- [x] 4.3 Write property test for emergency admin access
  - **Property 3: Emergency admin access via environment variable**
  - **Validates: Requirements 2.4**


- [x] 5. Implement basic FastAPI routes and middleware
  - Create main.py with FastAPI app initialization
  - Set up CORS middleware for Next.js frontend
  - Create /api/auth/register endpoint
  - Create /api/auth/login endpoint
  - Create /api/health endpoint
  - Add request logging middleware
  - Add global exception handler
  - _Requirements: 20.1, 20.6, 20.7_

- [x] 5.1 Write unit tests for auth endpoints
  - Test registration creates user with free plan
  - Test login returns valid token
  - Test invalid credentials return 401
  - _Requirements: 1.1, 1.2_

- [x] 6. Implement basic Next.js frontend with authentication
  - Create pages/index.tsx with login/register forms
  - Create pages/chat.tsx as main chat interface (protected route)
  - Create lib/supabase.ts for Supabase client
  - Create components/AuthForm.tsx for login/register
  - Implement authentication flow with Supabase Auth
  - Add protected route logic (redirect to login if not authenticated)
  - _Requirements: 22.1, 22.3, 22.6_

- [x] 6.1 Write unit tests for authentication components
  - Test AuthForm renders correctly
  - Test protected route redirects unauthenticated users
  - _Requirements: 22.3_

- [x] 7. Checkpoint - Ensure authentication works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

### PHASE 1: Local Core App - Chat Interface

- [x] 8. Implement chat service backend
  - Create services/chat.py
  - Implement create_session(user_id, title) function
  - Implement get_user_sessions(user_id) function
  - Implement send_message(user_id, session_id, message) function (stub for now)
  - Implement get_chat_history(user_id, session_id) function
  - Store messages in database with timestamps
  - _Requirements: 3.2, 3.4_


- [x] 8.1 Write property test for message persistence
  - **Property 8: Messages persist to database**
  - **Validates: Requirements 3.4**

- [x] 9. Create chat API endpoints
  - Create /api/chat/sessions endpoint (GET, POST)
  - Create /api/chat/sessions/{session_id}/messages endpoint (GET, POST)
  - Add authentication middleware to verify user
  - _Requirements: 3.2_

- [x] 9.1 Write property test for message routing
  - **Property 6: Messages are routed to backend**
  - **Validates: Requirements 3.2**

- [x] 10. Implement chat UI components
  - Create components/ChatWindow.tsx for message display
  - Create components/ChatInput.tsx for message input
  - Create components/SessionSidebar.tsx for session list
  - Implement message rendering with timestamps and sender
  - Add loading states and error handling
  - _Requirements: 22.3, 3.5_

- [x] 10.1 Write property test for message rendering
  - **Property 9: Message rendering includes metadata**
  - **Validates: Requirements 3.5**

- [x] 11. Wire chat components together
  - Connect ChatWindow to backend API
  - Implement session creation and switching
  - Implement message sending and receiving
  - Add real-time message updates
  - _Requirements: 3.2, 3.4_

- [x] 11.1 Write integration tests for chat flow
  - Test creating session, sending message, receiving response
  - Test session switching
  - _Requirements: 3.2, 3.4_

- [x] 12. Checkpoint - Ensure basic chat works locally
  - Ensure all tests pass, ask the user if questions arise.

### PHASE 2: Backend Intelligence - Rate Limiting


- [x] 13. Implement rate limiter service
  - Create services/rate_limiter.py
  - Define PLAN_LIMITS constants for free, student, pro, admin plans
  - Implement check_rate_limit(user_id, feature) function
  - Implement increment_usage(user_id, tokens, feature) function
  - Implement get_user_usage(user_id) function
  - Implement admin bypass logic
  - _Requirements: 9.1, 9.2, 9.5, 9.6_

- [x] 13.1 Write property test for rate limit checking
  - **Property 21: Rate limits are checked before processing**
  - **Validates: Requirements 9.2**

- [x] 13.2 Write property test for request rejection over limit
  - **Property 22: Requests over limit are rejected**
  - **Validates: Requirements 9.3**

- [x] 13.3 Write property test for admin bypass
  - **Property 24: Admin users bypass rate limits**
  - **Validates: Requirements 9.5**

- [x] 13.4 Write property test for multi-level limiting
  - **Property 25: Multi-level rate limiting**
  - **Validates: Requirements 9.6**

- [x] 14. Implement usage tracking
  - Update chat service to call increment_usage after each message
  - Track tokens_used, requests_count
  - Store usage in usage_counters table
  - _Requirements: 9.1_

- [x] 14.1 Write property test for usage tracking
  - **Property 20: Usage tracking is comprehensive**
  - **Validates: Requirements 9.1**

- [x] 15. Implement daily counter reset job
  - Create services/scheduler.py
  - Implement reset_daily_counters() function
  - Set up scheduled job to run at midnight UTC
  - _Requirements: 9.4_

- [x] 15.1 Write property test for daily reset
  - **Property 23: Daily counters reset at midnight UTC**
  - **Validates: Requirements 9.4**


- [x] 16. Add rate limiting to chat endpoints
  - Add rate_limiter check before processing chat messages
  - Return 429 error with upgrade prompt when limit exceeded
  - Include limit details in error response
  - _Requirements: 9.2, 9.3, 28.2_

- [x] 16.1 Write unit tests for rate limit errors
  - Test error message includes upgrade prompt
  - Test error includes limit details
  - _Requirements: 28.2_

- [x] 17. Checkpoint - Ensure rate limiting works
  - Ensure all tests pass, ask the user if questions arise.

### PHASE 2: Backend Intelligence - Model Router & Provider Integration

- [x] 18. Implement API key encryption utilities
  - Create services/encryption.py
  - Implement encrypt_key(plaintext) function using AES-256-GCM
  - Implement decrypt_key(ciphertext) function
  - Store encryption key in environment variable
  - _Requirements: 10.1, 30.1_

- [x] 18.1 Write property test for API key encryption
  - **Property 26: API keys are encrypted at rest**
  - **Validates: Requirements 10.1, 10.5**

- [x] 19. Implement model router service
  - Create services/model_router.py
  - Implement select_provider(feature) function
  - Implement get_active_key(provider, feature) function with priority ordering
  - Implement decrypt and return highest priority active key
  - _Requirements: 10.4, 10.6, 21.1_

- [x] 19.1 Write property test for key priority selection
  - **Property 28: Higher priority keys are selected first**
  - **Validates: Requirements 10.4**

- [x] 19.2 Write property test for key decryption
  - **Property 29: Backend decrypts and uses correct key**
  - **Validates: Requirements 10.6**


- [x] 20. Implement Gemini Flash provider integration
  - Create services/providers/gemini.py
  - Implement format_request(prompt) for Gemini API format
  - Implement call_gemini(api_key, prompt) function
  - Implement streaming support for responses
  - Handle Gemini-specific errors and rate limits
  - _Requirements: 21.6_

- [x] 20.1 Write unit tests for Gemini integration
  - Test request formatting
  - Test error handling
  - _Requirements: 21.6_

- [x] 21. Implement provider fallback logic
  - Update model_router to implement execute_with_fallback(provider, key, prompt)
  - On failure, automatically retry with next available key
  - Track failure counts per key
  - Support up to 3 retry attempts
  - _Requirements: 21.2, 21.3_

- [x] 21.1 Write property test for automatic retry
  - **Property 53: Failed requests trigger automatic retry**
  - **Validates: Requirements 21.2**

- [x] 22. Integrate model router with chat service
  - Update send_message to use model_router for AI responses
  - Implement streaming response from provider to frontend
  - Handle provider errors gracefully
  - _Requirements: 3.3, 21.1_

- [x] 22.1 Write property test for streaming responses
  - **Property 7: Chat responses are streamed**
  - **Validates: Requirements 3.3**

- [x] 23. Checkpoint - Ensure AI chat works with Gemini
  - Ensure all tests pass, ask the user if questions arise.

### PHASE 2: Backend Intelligence - Slash Commands

- [x] 24. Implement command parser
  - Create services/commands.py
  - Implement parse_command(message) function to detect slash commands
  - Support /flashcard, /mcq, /highyield, /explain, /map commands
  - Extract topic from command
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_


- [x] 24.1 Write property test for command routing
  - **Property 10: Slash commands route to correct handlers**
  - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

- [x] 25. Implement command handlers
  - Implement generate_flashcards(topic) function
  - Implement generate_mcqs(topic) function
  - Implement generate_summary(topic) function
  - Implement generate_explanation(topic) function
  - Implement generate_concept_map(topic) function
  - Each handler uses model_router for AI generation
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 25.1 Write unit tests for command handlers
  - Test each handler generates appropriate output
  - Test handlers use model_router
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 26. Implement command-specific usage tracking
  - Track mcqs_generated counter
  - Track flashcards_generated counter
  - Update rate_limiter to check command-specific limits
  - _Requirements: 4.7_

- [x] 26.1 Write property test for command usage tracking
  - **Property 11: Command usage is tracked separately**
  - **Validates: Requirements 4.7**

- [x] 27. Integrate commands with chat service
  - Update send_message to detect and route slash commands
  - Return command results in chat format
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 27.1 Write integration tests for command flow
  - Test sending /flashcard command returns flashcards
  - Test sending /mcq command returns MCQs
  - _Requirements: 4.1, 4.2_

- [x] 28. Checkpoint - Ensure slash commands work
  - Ensure all tests pass, ask the user if questions arise.

### PHASE 3: Admin System - Admin Access Control


- [x] 29. Implement admin middleware
  - Create middleware/admin_auth.py
  - Implement verify_admin_access(user_id) function
  - Check admin_allowlist table for email and role
  - Implement emergency admin token verification
  - Return 403 for non-admin users
  - _Requirements: 2.2, 2.6, 2.7_

- [x] 29.1 Write property test for emergency admin token
  - **Property 4: Emergency admin token grants access**
  - **Validates: Requirements 2.6**

- [x] 29.2 Write property test for admin route protection
  - **Property 5: Non-admin users cannot access admin routes**
  - **Validates: Requirements 2.7**

- [x] 30. Implement audit logging service
  - Create services/audit.py
  - Implement log_admin_action(admin_id, action_type, target_type, target_id, details) function
  - Store logs in audit_logs table
  - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

- [x] 30.1 Write property test for admin action logging
  - **Property 44: Admin actions are logged**
  - **Validates: Requirements 13.6, 19.1, 19.2, 19.3, 19.4, 19.5**

- [x] 31. Create admin service for user management
  - Create services/admin.py
  - Implement list_users(filters) function
  - Implement update_user_plan(user_id, plan) function with audit logging
  - Implement reset_user_usage(user_id) function with audit logging
  - Implement disable_user(user_id) function with audit logging
  - _Requirements: 13.1, 13.3, 13.4, 13.5_

- [x] 31.1 Write property test for plan modification
  - **Property 42: Admins can modify user plans**
  - **Validates: Requirements 13.3**

- [x] 31.2 Write property test for usage reset
  - **Property 43: Admins can reset usage counters**
  - **Validates: Requirements 13.4**


- [x] 32. Create admin API endpoints
  - Create /api/admin/users endpoint (GET) with admin middleware
  - Create /api/admin/users/{user_id}/plan endpoint (PUT) with admin middleware
  - Create /api/admin/users/{user_id}/usage/reset endpoint (POST) with admin middleware
  - Create /api/admin/users/{user_id}/disable endpoint (POST) with admin middleware
  - Create /api/admin/audit-logs endpoint (GET) with admin middleware
  - _Requirements: 13.1, 13.3, 13.4, 13.5, 19.6_

- [x] 32.1 Write integration tests for admin user management
  - Test admin can list users
  - Test admin can change user plan
  - Test non-admin cannot access admin endpoints
  - _Requirements: 13.1, 13.3, 2.7_

- [x] 33. Checkpoint - Ensure admin access control works
  - Ensure all tests pass, ask the user if questions arise.

### PHASE 3: Admin System - Admin UI

- [x] 34. Create admin panel layout
  - Create pages/admin/index.tsx (protected admin route)
  - Create components/AdminLayout.tsx with navigation
  - Create components/AdminSidebar.tsx with menu items
  - Add admin route protection (check admin role)
  - _Requirements: 2.7, 13.7_

- [x] 34.1 Write unit tests for admin route protection
  - Test non-admin redirected from admin pages
  - Test admin can access admin pages
  - _Requirements: 2.7_

- [x] 35. Create user management UI
  - Create pages/admin/users.tsx
  - Create components/UserList.tsx to display users
  - Create components/UserDetails.tsx for user info
  - Implement plan change dropdown
  - Implement usage reset button
  - Implement disable user button
  - Connect to admin API endpoints
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 35.1 Write unit tests for user management UI
  - Test UserList renders users correctly
  - Test plan change triggers API call
  - _Requirements: 13.1, 13.3_


- [x] 36. Create audit log viewer UI
  - Create pages/admin/audit-logs.tsx
  - Create components/AuditLogTable.tsx
  - Implement filtering by admin, action type, date
  - Implement search functionality
  - Connect to audit logs API endpoint
  - _Requirements: 19.6_

- [x] 36.1 Write unit tests for audit log UI
  - Test AuditLogTable renders logs correctly
  - Test filtering works
  - _Requirements: 19.6_

- [x] 37. Checkpoint - Ensure admin UI works
  - Ensure all tests pass, ask the user if questions arise.

### PHASE 4: API Key Pool & Health Checks - Key Management

- [x] 38. Implement admin API key management service
  - Add add_api_key(provider, feature, key, priority) to admin.py
  - Add list_api_keys() to admin.py
  - Add update_key_status(key_id, status) to admin.py
  - Add delete_api_key(key_id) to admin.py
  - Add test_api_key(key) to admin.py for validation
  - All functions include audit logging
  - _Requirements: 14.2, 14.4, 14.6, 14.7_

- [x] 38.1 Write property test for API key addition
  - **Property 45: Admins can add API keys**
  - **Validates: Requirements 14.2**

- [x] 38.2 Write property test for key validation
  - **Property 46: API keys are validated before storage**
  - **Validates: Requirements 14.7**

- [x] 38.3 Write property test for key status toggle
  - **Property 47: Admins can toggle key status**
  - **Validates: Requirements 14.4**

- [x] 39. Create API key management endpoints
  - Create /api/admin/api-keys endpoint (GET, POST) with admin middleware
  - Create /api/admin/api-keys/{key_id} endpoint (PUT, DELETE) with admin middleware
  - Create /api/admin/api-keys/test endpoint (POST) for key validation
  - _Requirements: 14.2, 14.4, 14.6, 14.7_


- [x] 39.1 Write integration tests for API key management
  - Test admin can add key
  - Test key is encrypted in database
  - Test admin can update key status
  - _Requirements: 14.2, 14.4, 10.1_

- [x] 40. Create API key management UI
  - Create pages/admin/api-keys.tsx
  - Create components/ApiKeyList.tsx to display keys (masked)
  - Create components/AddApiKeyForm.tsx for adding keys
  - Implement key status toggle buttons
  - Implement key deletion with confirmation
  - Implement priority adjustment
  - Connect to API key endpoints
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

- [x] 40.1 Write unit tests for API key UI
  - Test ApiKeyList masks key values
  - Test AddApiKeyForm validates input
  - _Requirements: 14.3, 14.2_

- [x] 41. Checkpoint - Ensure API key management works
  - Ensure all tests pass, ask the user if questions arise.

### PHASE 4: API Key Pool & Health Checks - Health Monitoring

- [x] 42. Implement health monitor service
  - Create services/health_monitor.py
  - Implement check_provider_health(provider, key) function with minimal test calls
  - Implement record_failure(key_id, error) function
  - Implement mark_key_degraded(key_id) function after N failures
  - Implement get_provider_status(provider, feature) function
  - Store health data in provider_health table
  - _Requirements: 11.1, 11.2, 11.3, 11.6_

- [x] 42.1 Write property test for health checks
  - **Property 30: Health checks occur periodically**
  - **Validates: Requirements 11.1**

- [x] 42.2 Write property test for failure tracking
  - **Property 31: Failures increment failure counter**
  - **Validates: Requirements 11.2**

- [x] 42.3 Write property test for key degradation
  - **Property 32: Repeated failures mark key as degraded**
  - **Validates: Requirements 11.3**


- [x] 42.4 Write property test for health logging
  - **Property 35: Health checks are logged**
  - **Validates: Requirements 11.6**

- [x] 43. Implement periodic health check background task
  - Add background task to main.py using FastAPI BackgroundTasks
  - Schedule health checks every 5 minutes for all active keys
  - _Requirements: 11.1_

- [x] 43.1 Write unit tests for background health checks
  - Test health checks run on schedule
  - Test all active keys are checked
  - _Requirements: 11.1_

- [x] 44. Update model router to use health status
  - Update get_active_key to skip degraded keys
  - Implement fallback to next priority key when primary is degraded
  - _Requirements: 11.4_

- [x] 44.1 Write property test for degraded key fallback
  - **Property 33: Degraded keys trigger fallback**
  - **Validates: Requirements 11.4**

- [x] 45. Implement feature failure isolation
  - Ensure key failures in one feature don't affect other features
  - Track health status per feature-provider combination
  - _Requirements: 11.5_

- [x] 45.1 Write property test for failure isolation
  - **Property 34: Feature failure isolation**
  - **Validates: Requirements 11.5**

- [x] 46. Checkpoint - Ensure health monitoring works
  - Ensure all tests pass, ask the user if questions arise.

### PHASE 4: API Key Pool & Health Checks - Notifications & Maintenance

- [x] 47. Implement notification service
  - Create services/notifications.py
  - Implement send_email(to, subject, body) function (use SMTP or email service)
  - Implement send_webhook(url, payload) function
  - Implement notify_api_key_failure(key_id, error) function
  - Implement notify_fallback(from_key, to_key) function
  - Implement notify_maintenance_triggered(level, reason) function
  - Implement notify_admin_override(admin_id, action) function
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_


- [x] 47.1 Write property test for critical event notifications
  - **Property 51: Critical events trigger notifications**
  - **Validates: Requirements 18.1, 18.2, 18.3, 18.4**

- [x] 48. Integrate notifications with health monitor
  - Call notify_api_key_failure when key fails
  - Call notify_fallback when fallback occurs
  - _Requirements: 11.7_

- [x] 48.1 Write property test for failover notification
  - **Property 36: Failover triggers admin notification**
  - **Validates: Requirements 11.7**

- [x] 49. Implement maintenance service
  - Create services/maintenance.py
  - Implement evaluate_maintenance_trigger(feature, failures) function
  - Implement enter_maintenance(level, reason) function
  - Implement exit_maintenance() function
  - Implement get_maintenance_status() function
  - Store maintenance state in system_flags table
  - Support soft and hard maintenance levels
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [x] 49.1 Write property test for maintenance triggering
  - **Property 37: Total key failure triggers maintenance**
  - **Validates: Requirements 12.1, 12.2, 12.3**

- [x] 49.2 Write property test for soft maintenance behavior
  - **Property 38: Soft maintenance pauses heavy features**
  - **Validates: Requirements 12.5**

- [x] 49.3 Write property test for hard maintenance behavior
  - **Property 39: Hard maintenance allows admin-only access**
  - **Validates: Requirements 12.6**

- [x] 50. Integrate maintenance with model router
  - Update model_router to trigger maintenance when all keys fail
  - Call notify_maintenance_triggered when entering maintenance
  - _Requirements: 12.1, 12.9_

- [x] 50.1 Write property test for automatic maintenance notification
  - **Property 41: Automatic maintenance triggers notification**
  - **Validates: Requirements 12.9**


- [x] 51. Implement maintenance middleware
  - Create middleware/maintenance.py
  - Check maintenance status before processing requests
  - In soft maintenance: block heavy features, allow chat and admin
  - In hard maintenance: block all except admin
  - Return 503 with maintenance message
  - _Requirements: 12.5, 12.6_

- [x] 51.1 Write unit tests for maintenance middleware
  - Test soft maintenance blocks heavy features
  - Test hard maintenance blocks non-admin
  - _Requirements: 12.5, 12.6_

- [x] 52. Create maintenance control endpoints and UI
  - Create /api/admin/maintenance endpoint (GET, POST) with admin middleware
  - Create /api/admin/maintenance/override endpoint (POST) with admin middleware
  - Create pages/admin/maintenance.tsx
  - Create components/MaintenanceControl.tsx
  - Implement manual maintenance trigger buttons
  - Implement override button
  - Display current maintenance status
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

- [x] 52.1 Write property test for manual maintenance trigger
  - **Property 50: Admins can manually trigger maintenance**
  - **Validates: Requirements 17.2**

- [x] 52.2 Write property test for manual override
  - **Property 40: Manual override restores operation**
  - **Validates: Requirements 12.8**

- [x] 53. Create provider health dashboard UI
  - Create pages/admin/provider-health.tsx
  - Create components/ProviderHealthTable.tsx
  - Display current health status per provider/feature
  - Display recent failure logs
  - Display current failover status
  - Implement manual health check trigger button
  - _Requirements: 15.1, 15.2, 15.3, 15.4_

- [x] 53.1 Write unit tests for provider health UI
  - Test ProviderHealthTable displays status correctly
  - Test manual health check triggers API call
  - _Requirements: 15.1, 15.4_

- [x] 54. Checkpoint - Ensure maintenance system works
  - Ensure all tests pass, ask the user if questions arise.


### PHASE 4: API Key Pool & Health Checks - Feature Toggles

- [x] 55. Implement feature toggle service
  - Add toggle_feature(feature, enabled) to admin.py
  - Add get_feature_status() to admin.py
  - Store feature toggles in system_flags table
  - Include audit logging
  - _Requirements: 16.2, 16.4_

- [x] 55.1 Write property test for feature toggles
  - **Property 48: Admins can toggle features globally**
  - **Validates: Requirements 16.2**

- [x] 56. Implement feature toggle enforcement
  - Create middleware/feature_toggle.py
  - Check feature status before processing feature-specific requests
  - Return clear error message when feature disabled
  - _Requirements: 16.3_

- [x] 56.1 Write property test for disabled feature rejection
  - **Property 49: Disabled features reject requests**
  - **Validates: Requirements 16.3**

- [x] 57. Create feature toggle UI
  - Create pages/admin/features.tsx
  - Create components/FeatureToggleList.tsx
  - Display all features with current status
  - Implement toggle switches
  - Connect to feature toggle endpoints
  - _Requirements: 16.1, 16.2_

- [x] 57.1 Write unit tests for feature toggle UI
  - Test FeatureToggleList displays features correctly
  - Test toggle triggers API call
  - _Requirements: 16.1, 16.2_

- [x] 58. Checkpoint - Ensure feature toggles work
  - Ensure all tests pass, ask the user if questions arise.

### PHASE 4: Optional Features - User-Supplied API Keys

- [x] 59. Implement user API key management
  - Add set_user_api_key(user_id, key) to auth service
  - Add get_user_api_key(user_id) to auth service
  - Add remove_user_api_key(user_id) to auth service
  - Encrypt user keys before storage
  - Validate keys before accepting
  - _Requirements: 27.1, 27.3, 27.5_


- [x] 59.1 Write property test for user key validation
  - **Property 55: User key validation before acceptance**
  - **Validates: Requirements 27.3**

- [ ] 60. Update model router to prioritize user keys
  - Check if user has personal API key
  - Use user key with priority over shared keys
  - Fall back to shared keys if user key fails
  - _Requirements: 27.2, 27.7_

- [ ] 60.1 Write property test for user key priority
  - **Property 54: User-supplied keys have priority**
  - **Validates: Requirements 27.2**

- [ ] 60.2 Write property test for user key fallback
  - **Property 56: Failed user keys fall back to shared keys**
  - **Validates: Requirements 27.7**

- [ ] 61. Create user API key management UI
  - Create pages/profile.tsx
  - Create components/UserApiKeyForm.tsx
  - Implement add/update/remove personal API key
  - Display key status and usage
  - _Requirements: 27.1, 27.5_

- [ ] 61.1 Write unit tests for user API key UI
  - Test UserApiKeyForm validates input
  - Test key is masked in display
  - _Requirements: 27.1_

- [ ] 62. Checkpoint - Ensure user API keys work
  - Ensure all tests pass, ask the user if questions arise.

### PHASE 4: Optional Features - PDF and Document Processing

- [ ] 63. Implement document service
  - Create services/documents.py
  - Implement upload_document(user_id, file) function
  - Implement process_pdf(document_id) async function for text extraction
  - Implement generate_embeddings(text) function using embedding model
  - Implement semantic_search(user_id, query, top_k) function using pgvector
  - Implement get_user_documents(user_id) function
  - Implement delete_document(document_id) function
  - Store documents and embeddings in database
  - _Requirements: 7.1, 7.2, 8.2, 8.4, 8.5_


- [ ] 63.1 Write property test for PDF embedding generation
  - **Property 15: PDF upload generates embeddings**
  - **Validates: Requirements 7.2**

- [ ] 63.2 Write property test for embedding persistence
  - **Property 18: Document embeddings persist**
  - **Validates: Requirements 8.4**

- [ ] 63.3 Write property test for semantic search
  - **Property 19: Semantic search returns relevant results**
  - **Validates: Requirements 8.5**

- [ ] 64. Implement PDF upload tracking
  - Update rate_limiter to track pdf_uploads counter
  - Check PDF upload limits before accepting uploads
  - _Requirements: 7.6_

- [ ] 64.1 Write property test for upload tracking
  - **Property 16: Upload counts tracked against quotas**
  - **Validates: Requirements 7.6**

- [ ] 65. Create document upload endpoints
  - Create /api/documents endpoint (GET, POST)
  - Create /api/documents/{document_id} endpoint (DELETE)
  - Add file upload handling
  - Trigger async PDF processing
  - _Requirements: 7.1, 7.2_

- [ ] 65.1 Write integration tests for document upload
  - Test PDF upload and processing
  - Test upload quota enforcement
  - _Requirements: 7.1, 7.6_

- [ ] 66. Implement RAG-grounded chat
  - Update chat service to check if user has documents
  - If documents exist, perform semantic search before generating response
  - Include relevant document chunks in prompt context
  - Add citations to response
  - _Requirements: 8.1, 8.3_

- [ ] 66.1 Write property test for RAG citations
  - **Property 17: RAG responses include citations**
  - **Validates: Requirements 8.3**


- [ ] 67. Create document management UI
  - Create pages/documents.tsx
  - Create components/DocumentUpload.tsx
  - Create components/DocumentList.tsx
  - Implement file upload with progress
  - Display processing status
  - Implement document deletion
  - _Requirements: 7.1_

- [ ] 67.1 Write unit tests for document UI
  - Test DocumentUpload handles file selection
  - Test DocumentList displays documents
  - _Requirements: 7.1_

- [ ] 68. Checkpoint - Ensure document processing works
  - Ensure all tests pass, ask the user if questions arise.

### PHASE 4: Optional Features - Clinical Tools & Study Planner

- [ ] 69. Implement clinical reasoning mode
  - Create services/clinical.py
  - Implement create_clinical_case() function to generate patient cases
  - Implement present_case_progressively(session_id) function
  - Implement evaluate_clinical_reasoning(user_response) function
  - Track user performance
  - _Requirements: 5.1, 5.3, 5.5_

- [ ] 69.1 Write property test for progressive case presentation
  - **Property 12: Clinical reasoning presents cases progressively**
  - **Validates: Requirements 5.3**

- [ ] 70. Implement OSCE simulator
  - Add create_osce_scenario() to clinical.py
  - Add simulate_examiner_interaction(user_action) function
  - Track OSCE performance
  - _Requirements: 5.2, 5.4, 5.5_

- [ ] 70.1 Write property test for OSCE examiner interactions
  - **Property 13: OSCE mode generates examiner interactions**
  - **Validates: Requirements 5.4**

- [ ] 71. Create clinical tools endpoints
  - Create /api/clinical/reasoning endpoint (POST)
  - Create /api/clinical/osce endpoint (POST)
  - _Requirements: 5.1, 5.2_


- [ ] 71.1 Write integration tests for clinical tools
  - Test clinical reasoning flow
  - Test OSCE simulation flow
  - _Requirements: 5.3, 5.4_

- [ ] 72. Implement study planner service
  - Create services/study_planner.py
  - Implement create_study_session(user_id, topic, duration) function
  - Implement get_study_sessions(user_id) function
  - Implement update_study_session(session_id, data) function
  - Implement delete_study_session(session_id) function
  - Store study plans in database
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 72.1 Write property test for study plan CRUD
  - **Property 14: Study plan CRUD operations work correctly**
  - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [ ] 73. Create study planner endpoints
  - Create /api/study-planner/sessions endpoint (GET, POST)
  - Create /api/study-planner/sessions/{session_id} endpoint (PUT, DELETE)
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 73.1 Write integration tests for study planner
  - Test creating and retrieving study sessions
  - Test updating and deleting sessions
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 74. Create clinical tools and study planner UI
  - Create pages/clinical-reasoning.tsx
  - Create pages/osce.tsx
  - Create pages/study-planner.tsx
  - Create components for each tool
  - Connect to backend endpoints
  - _Requirements: 5.1, 5.2, 6.1_

- [ ] 74.1 Write unit tests for clinical and study planner UI
  - Test components render correctly
  - Test user interactions
  - _Requirements: 5.1, 5.2, 6.1_

- [ ] 75. Checkpoint - Ensure clinical tools and study planner work
  - Ensure all tests pass, ask the user if questions arise.


### PHASE 4: Optional Features - Payment Integration (Future)

- [ ] 76. Implement Razorpay integration service
  - Create services/payments.py
  - Implement create_subscription(user_id, plan) function
  - Implement handle_payment_webhook(payload) function
  - Implement cancel_subscription(subscription_id) function
  - Store subscription and payment records
  - _Requirements: 24.1, 24.2, 24.6_

- [ ] 76.1 Write property test for payment success
  - **Property 57: Payment success updates user plan**
  - **Validates: Requirements 24.3**

- [ ] 76.2 Write property test for subscription expiry
  - **Property 58: Subscription expiry downgrades plan**
  - **Validates: Requirements 24.4**

- [ ] 77. Create payment endpoints
  - Create /api/payments/subscribe endpoint (POST)
  - Create /api/payments/webhook endpoint (POST) for Razorpay webhooks
  - Create /api/payments/cancel endpoint (POST)
  - _Requirements: 24.2, 24.6, 24.7_

- [ ] 77.1 Write integration tests for payment flow
  - Test subscription creation
  - Test webhook handling
  - Test plan upgrade on payment
  - _Requirements: 24.2, 24.3_

- [ ] 78. Create pricing and payment UI
  - Create pages/pricing.tsx
  - Create components/PricingCard.tsx
  - Create components/PaymentForm.tsx
  - Implement Razorpay checkout integration
  - _Requirements: 24.1_

- [ ] 78.1 Write unit tests for payment UI
  - Test PricingCard displays plan details
  - Test PaymentForm handles submission
  - _Requirements: 24.1_

- [ ] 79. Checkpoint - Ensure payment integration works
  - Ensure all tests pass, ask the user if questions arise.

### PHASE 5: System Visual / Guidance


- [ ] 80. Create comprehensive system guide
  - Document all services and their responsibilities
  - Document all features and how they work
  - Create data flow diagrams for key scenarios
  - Document admin control points
  - Document failure and maintenance logic
  - Document API key pool management
  - Document rate limiting and quota system
  - Document security measures
  - Create architecture diagram
  - This guide is for developer reference only
  - Store as inline comments in code and one consolidated guide
  - _Requirements: All_

- [ ] 81. Checkpoint - Review system guide
  - Ensure all tests pass, ask the user if questions arise.

### PHASE 6: Hosting (Final Phase)

- [ ] 82. Prepare backend for Heroku deployment
  - Create Procfile for uvicorn
  - Create requirements.txt with all dependencies
  - Set up environment variables in Heroku
  - Configure Supabase cloud connection
  - Test deployment locally with production settings
  - _Requirements: 26.2_

- [ ] 82.1 Write deployment verification tests
  - Test production environment configuration
  - Test database connection
  - _Requirements: 26.2_

- [ ] 83. Deploy backend to Heroku
  - Create Heroku app
  - Deploy FastAPI application
  - Configure environment variables
  - Verify health endpoint
  - _Requirements: 26.2_

- [ ] 84. Prepare frontend for Netlify deployment
  - Configure build settings
  - Set up environment variables for production API URL
  - Test production build locally
  - _Requirements: 26.1_

- [ ] 84.1 Write deployment verification tests
  - Test production build succeeds
  - Test environment variables are loaded
  - _Requirements: 26.1_


- [ ] 85. Deploy frontend to Netlify
  - Create Netlify site
  - Configure build command and publish directory
  - Set up environment variables
  - Deploy and verify
  - _Requirements: 26.1_

- [ ] 86. Configure Supabase for production
  - Set up production Supabase project
  - Run database migrations
  - Configure RLS policies
  - Set up connection pooling
  - Configure backups
  - _Requirements: 26.3_

- [ ] 87. Optional: Configure Cloudflare CDN
  - Set up DNS management
  - Configure SSL/TLS
  - Set up caching rules
  - Configure DDoS protection
  - _Requirements: 26.4_

- [ ] 88. Verify production deployment
  - Test authentication flow
  - Test chat functionality
  - Test admin panel access
  - Test API key management
  - Test rate limiting
  - Test maintenance mode
  - Verify all features work in production
  - _Requirements: 26.1, 26.2, 26.3_

- [ ] 88.1 Write end-to-end production tests
  - Test complete user flow in production
  - Test admin flow in production
  - _Requirements: 26.1, 26.2_

- [ ] 89. Final checkpoint - Production deployment complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive quality assurance
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- All tasks build incrementally with no orphaned code
- Follow the strict phase order: Local Core → Backend Intelligence → Admin System → API Key Pool → System Guide → Hosting
- DO NOT deploy until all local testing is complete (Phase 6 is last)
