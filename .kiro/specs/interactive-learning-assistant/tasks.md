# Implementation Plan: Interactive Learning Assistant (Teach-Back Mode)

## Overview

This implementation plan breaks down the Interactive Learning Assistant feature into discrete, incremental coding tasks. The feature is implemented as an isolated module (`backend/teach_back/`) with its own session management, state machine, rate limiting, and voice processing capabilities. Each task builds on previous work, with checkpoints to ensure stability before proceeding.

The implementation follows a requirements-first approach with comprehensive property-based testing to ensure correctness across all inputs. All 29 correctness properties from the design document are implemented as property-based tests with minimum 100 iterations each.

**Programming Language**: Python (backend), TypeScript (frontend)

## Tasks

- [x] 1. Set up teach-back module structure and database schema
  - Create `backend/teach_back/` directory with `__init__.py`
  - Create database migration file for all teach-back tables (sessions, transcripts, errors, examinations, summaries, usage)
  - Include proper indexes, constraints, and CHECK clauses for enums
  - Add updated_at trigger for sessions table
  - Run migration to create tables
  - Create `backend/teach_back/models.py` with Pydantic models for Session, TranscriptEntry, DetectedError, ExaminationQA, SessionSummary
  - Define enums: InputMode (text, voice, mixed), OutputMode (text, voice_text), SessionState (teaching, interrupted, examining, completed), ErrorSeverity (minor, moderate, critical)
  - _Requirements: 3.1, 3.2, 10.1_

- [ ] 2. Implement data storage layer
  - [x] 2.1 Create `backend/teach_back/data_storage.py` with DataStorage class
    - Implement `save_session()`, `get_session()`, `save_transcript_entry()`, `save_error()`, `save_examination_qa()`, `save_summary()`, `get_session_transcript()`, `get_user_sessions()`, `get_session_errors()` methods
    - Use async/await for all database operations
    - Include proper error handling and transaction management
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_
  
  - [x] 2.2 Write property test for session data round-trip
    - **Property 17: Session Data Round-Trip**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7**
    - Generate random sessions with transcripts, errors, Q&As, and summaries
    - Save to database and retrieve
    - Verify all data matches original
    - Run with minimum 100 iterations

- [ ] 3. Implement state machine
  - [x] 3.1 Create `backend/teach_back/state_machine.py` with StateMachine class
    - Define SessionState enum (TEACHING, INTERRUPTED, EXAMINING, COMPLETED)
    - Implement `transition()`, `get_current_state()`, `can_transition()` methods
    - Define valid state transition rules
    - Log all transitions with timestamps
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_
  
  - [x] 3.2 Write property test for state machine transitions
    - **Property 23: State Machine Transitions**
    - **Validates: Requirements 16.1, 16.4, 16.5, 16.6, 14.1**
    - Generate random valid state transition sequences
    - Verify all transitions succeed and are logged
    - Verify invalid transitions are rejected
    - Run with minimum 100 iterations

- [ ] 4. Implement rate limiter
  - [x] 4.1 Create `backend/teach_back/rate_limiter.py` with TeachBackRateLimiter class
    - Define TEACH_BACK_LIMITS dictionary with plan-based quotas
    - Implement `check_session_limit()`, `increment_session_count()`, `get_remaining_quota()` methods
    - Implement voice session cost premium (2x credits)
    - Query and update teach_back_usage table
    - _Requirements: 8.1, 8.2, 8.6_
  
  - [x] 4.2 Write property test for rate limit independence
    - **Property 4: Rate Limit Independence**
    - **Validates: Requirements 3.4, 8.1**
    - Generate random teach-back and other feature usage patterns
    - Verify teach-back quotas don't affect other features
    - Verify other feature usage doesn't affect teach-back quotas
    - Run with minimum 100 iterations
  
  - [x] 4.3 Write property test for voice session cost premium
    - **Property 10: Voice Session Cost Premium**
    - **Validates: Requirements 8.2**
    - Generate random voice and text sessions
    - Verify voice sessions deduct more quota than text sessions
    - Run with minimum 100 iterations
  
  - [x] 4.4 Write property test for quota enforcement
    - **Property 11: Quota Enforcement**
    - **Validates: Requirements 8.6**
    - Generate users at quota limit
    - Verify new session creation is rejected with quota info
    - Run with minimum 100 iterations

- [x] 5. Checkpoint - Ensure core infrastructure tests pass
  - Run all tests for data storage, state machine, and rate limiter
  - Verify database schema is correct
  - Ask the user if questions arise

- [ ] 6. Implement voice processor
  - [x] 6.1 Create `backend/teach_back/voice_processor.py` with VoiceProcessor class
    - Initialize with configurable models directory path from environment variable LOCAL_MODELS_DIR (default: /local_models)
    - Construct model paths relative to LOCAL_MODELS_DIR: `{LOCAL_MODELS_DIR}/stt/whisper-large-v3` and `{LOCAL_MODELS_DIR}/tts/piper`
    - Implement `transcribe_audio()` using Whisper-large-v3 for STT
    - Implement `synthesize_speech()` using Piper TTS for voice output
    - Implement `is_stt_available()` and `is_tts_available()` health checks
    - Handle failures gracefully with proper error codes (STT_UNAVAILABLE, STT_FAILED, TTS_UNAVAILABLE, TTS_FAILED)
    - Support continuous voice input (no manual activation per utterance)
    - Handle poor audio quality with AUDIO_QUALITY_POOR error code
    - _Requirements: 5.4, 5.5, 6.2, 6.3, 6.4, 6.5, 17.1, 17.2, 17.4, 17.5, 18.1, 18.2, 18.6_
  
  - [x] 6.2 Write property test for model path construction
    - **Property 9: Model Path Construction**
    - **Validates: Requirements 6.5**
    - Generate random LOCAL_MODELS_DIR values
    - Verify constructed paths are relative to configuration value
    - Verify no hardcoded paths exist
    - Run with minimum 100 iterations
  
  - [x] 6.3 Write property test for STT failure fallback
    - **Property 12: STT Failure Fallback**
    - **Validates: Requirements 9.1, 17.6**
    - Simulate STT engine failures
    - Verify automatic switch to text-only input mode
    - Verify user notification generated
    - Run with minimum 100 iterations
  
  - [x] 6.4 Write property test for TTS failure fallback
    - **Property 13: TTS Failure Fallback**
    - **Validates: Requirements 9.2, 18.5**
    - Simulate TTS engine failures
    - Verify automatic switch to text-only output mode
    - Verify user notification generated
    - Run with minimum 100 iterations
  
  - [x] 6.5 Write property test for voice input transcription
    - **Property 27: Voice Input Transcription**
    - **Validates: Requirements 17.1, 17.2, 17.3**
    - Generate random audio inputs
    - Verify STT processing generates text
    - Verify transcribed text appears in transcript
    - Run with minimum 100 iterations
  
  - [x] 6.6 Write property test for voice output generation
    - **Property 28: Voice Output Generation**
    - **Validates: Requirements 18.1, 18.2**
    - Generate random text responses
    - Verify TTS processing generates audio
    - Verify audio output created for voice+text mode
    - Run with minimum 100 iterations

- [ ] 7. Implement LLM role classes
  - [x] 7.1 Create `backend/teach_back/roles/` directory with `__init__.py`
    - Create `student_persona.py` with StudentPersona class implementing curious learner behavior
    - Create `evaluator.py` with Evaluator class implementing error detection logic
    - Create `controller.py` with Controller class implementing state transition decisions
    - Create `examiner.py` with Examiner class implementing OSCE-style examination
    - Each role should have `generate_response()` method that takes session context and returns response
    - StudentPersona: asks clarifying questions, shows enthusiasm, requests examples
    - Evaluator: detects factual errors, misconceptions, incomplete explanations; assigns severity (minor, moderate, critical)
    - Controller: decides when to interrupt (critical errors immediately, 3+ minor errors), manages pacing
    - Examiner: generates questions based on errors and taught content, evaluates responses with 0-10 scoring
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 13.1, 13.2, 14.2, 14.4, 15.1, 15.2_

- [ ] 8. Implement LLM orchestrator
  - [x] 8.1 Create `backend/teach_back/llm_orchestrator.py` with LLMOrchestrator class
    - Initialize with primary and fallback LLM configurations from models.json (new teach_back section with dedicated API keys)
    - Load role instances (StudentPersona, Evaluator, Controller, Examiner)
    - Implement `generate_response()` that selects appropriate role based on session state (teaching→Student/Evaluator, examining→Examiner)
    - Implement `detect_errors()` using Evaluator role to identify factual errors, misconceptions, incomplete explanations
    - Implement `generate_examination_question()` using Examiner role to create OSCE-style questions
    - Implement automatic failover from primary to fallback LLM with retry logic and exponential backoff
    - Filter/sanitize output to ensure role names (Student_Persona, Evaluator, Controller, Examiner) never appear in responses
    - Use dedicated API keys separate from other features (TEACH_BACK_PRIMARY_LLM_KEY, TEACH_BACK_FALLBACK_LLM_KEY)
    - Use m42-health/Llama3-Med42-70B via Hugging Face as Fallback_LLM
    - Handle LLM failures with proper error codes (PRIMARY_LLM_FAILED, FALLBACK_LLM_FAILED, ALL_LLMS_FAILED, LLM_RATE_LIMIT)
    - _Requirements: 4.5, 4.6, 5.1, 5.2, 5.3, 5.6, 13.1, 14.2, 14.3_
  
  - [x] 8.2 Write property test for internal role opacity
    - **Property 5: Internal Role Opacity**
    - **Validates: Requirements 4.5**
    - Generate random sessions in different states
    - Generate responses for each state
    - Verify responses don't contain role names (Student_Persona, Evaluator, Controller, Examiner)
    - Run with minimum 100 iterations
  
  - [x] 8.3 Write property test for state-based role selection
    - **Property 6: State-Based Role Selection**
    - **Validates: Requirements 4.6**
    - Generate random sessions in teaching, interrupted, and examining states
    - Verify teaching state uses Student_Persona or Evaluator
    - Verify examining state uses Examiner
    - Run with minimum 100 iterations
  
  - [x] 8.4 Write property test for LLM failover
    - **Property 7: LLM Failover**
    - **Validates: Requirements 5.2**
    - Simulate Primary_LLM failures
    - Verify automatic failover to Fallback_LLM
    - Verify no user intervention required
    - Run with minimum 100 iterations
  
  - [x] 8.5 Write property test for resource isolation
    - **Property 8: Resource Isolation**
    - **Validates: Requirements 5.6**
    - Verify teach-back uses distinct API keys from other features
    - Verify no quota sharing between teach-back and other features
    - Generate random usage patterns across features
    - Run with minimum 100 iterations

- [x] 9. Checkpoint - Ensure voice and LLM components work
  - Run all tests for voice processor and LLM orchestrator
  - Test with sample audio files and text inputs
  - Verify failover logic works correctly
  - Ask the user if questions arise

- [ ] 10. Implement session manager
  - [x] 10.1 Create `backend/teach_back/session_manager.py` with SessionManager class
    - Implement `create_session()` with mode validation, rate limit checking, and engine activation
    - Implement `get_session()` to retrieve session by ID with full context
    - Implement `end_session()` to transition to completed state and generate comprehensive summary
    - Implement `process_input()` to handle user input (text or voice) with appropriate processing
    - Coordinate with state machine for all state transitions (teaching, interrupted, examining, completed)
    - Coordinate with LLM orchestrator for response generation using appropriate roles
    - Coordinate with voice processor for audio transcription (STT) and synthesis (TTS)
    - Store all interactions in transcript with timestamps and speaker identification
    - Activate STT_Engine for Voice Only or Text+Voice Mixed input modes
    - Activate TTS_Engine for Voice+Text output mode
    - Generate complete text transcript regardless of input/output mode (convert voice to text)
    - Include all user inputs, system responses, and interruptions in transcript
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 4.6, 16.1_
  
  - [x] 10.2 Write property test for mode configuration consistency
    - **Property 1: Mode Configuration Consistency**
    - **Validates: Requirements 1.3, 1.4**
    - Generate random input and output mode combinations
    - Verify created sessions configured with selected modes
    - Run with minimum 100 iterations
  
  - [x] 10.3 Write property test for voice mode engine activation
    - **Property 2: Voice Mode Engine Activation**
    - **Validates: Requirements 1.5, 1.6**
    - Generate sessions with various mode combinations
    - Verify STT_Engine activated for Voice Only or Text+Voice Mixed input
    - Verify TTS_Engine activated for Voice+Text output
    - Run with minimum 100 iterations
  
  - [x] 10.4 Write property test for universal transcript generation
    - **Property 3: Universal Transcript Generation**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
    - Generate sessions with all mode combinations
    - Verify complete text transcript generated regardless of mode
    - Verify voice input converted to text in transcript
    - Verify all entries timestamped
    - Run with minimum 100 iterations

- [x] 11. Implement error detection and interruption logic
  - [x] 11.1 Add interruption handling to session manager
    - Detect errors using Evaluator during teaching phase
    - Generate interruptions with gentle, constructive corrections
    - Transition to interrupted state when error detected
    - Store errors in database with context and severity
    - Handle user acknowledgment and return to teaching state
    - Record all interruptions with timestamps
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_
  
  - [x] 11.2 Write property test for error detection triggers interruption
    - **Property 21: Error Detection Triggers Interruption**
    - **Validates: Requirements 13.1, 13.3, 13.4, 13.6**
    - Generate random teaching inputs with conceptual errors
    - Verify errors trigger interruptions with corrections
    - Verify state transitions to interrupted
    - Verify errors recorded in database
    - Run with minimum 100 iterations
  
  - [x] 11.3 Write property test for interruption acknowledgment recovery
    - **Property 22: Interruption Acknowledgment Recovery**
    - **Validates: Requirements 13.5**
    - Generate sessions in interrupted state
    - Simulate user acknowledgment
    - Verify state transitions back to teaching
    - Run with minimum 100 iterations

- [x] 12. Implement examination phase
  - [x] 12.1 Add examination logic to session manager
    - Transition to examining state when teaching ends
    - Generate questions using Examiner role based on errors and taught content
    - Focus questions on concepts taught incorrectly or incompletely
    - Evaluate user answers with scoring (0-10 scale)
    - Store Q&As in database with evaluations
    - Transition to completed state when examination ends
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_
  
  - [x] 12.2 Write property test for examination question targeting
    - **Property 24: Examination Question Targeting**
    - **Validates: Requirements 14.3**
    - Generate random sessions with various error patterns
    - Verify examination questions relate to detected errors
    - Verify questions focus on weak areas
    - Run with minimum 100 iterations
  
  - [x] 12.3 Write property test for examination evaluation and storage
    - **Property 25: Examination Evaluation and Storage**
    - **Validates: Requirements 14.4, 14.6**
    - Generate random examination Q&As
    - Verify answers are evaluated with scores
    - Verify Q&As stored in database
    - Run with minimum 100 iterations

- [x] 13. Implement session summary generation
  - [x] 13.1 Add summary generation to session manager
    - Generate comprehensive summary when session completes (state transitions to completed)
    - Include all detected errors with full context and corrections
    - Include all missed concepts identified during teaching and examination
    - Include strong areas where user performed well
    - Include personalized study recommendations based on weak areas
    - Include examination performance metrics (overall score 0-100 scale)
    - Calculate overall score based on: error count, error severity, examination scores, coverage completeness
    - Store summary in database with all fields populated
    - Display summary in session UI with clear formatting
    - Allow users to download or save session summary
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_
  
  - [x] 13.2 Write property test for session summary completeness
    - **Property 26: Session Summary Completeness**
    - **Validates: Requirements 19.1, 19.2, 19.3, 19.4**
    - Generate random completed sessions with various error patterns
    - Verify summaries contain all required elements
    - Verify summaries include examination metrics
    - Run with minimum 100 iterations

- [x] 14. Checkpoint - Ensure complete session flow works
  - Run end-to-end test of full session lifecycle
  - Test teaching → interruption → examination → summary flow
  - Verify all data persisted correctly
  - Ask the user if questions arise

- [x] 15. Implement failure handling
  - [x] 15.1 Add comprehensive failure handling to all components
    - Implement STT failure → automatic switch to text-only input mode with user notification
    - Implement TTS failure → automatic switch to text-only output mode with user notification
    - Implement Primary_LLM failure → pause session and notify user with retry options
    - Implement both LLMs failing → enter Maintenance_Mode and prevent new sessions
    - Ensure NO silent degradation - all failures generate user notifications
    - Log all failures with context, error codes, and stack traces
    - Log all service recoveries with timestamps
    - Resume normal operation automatically when services recover
    - Use proper error codes: STT_UNAVAILABLE, STT_FAILED, TTS_UNAVAILABLE, TTS_FAILED, PRIMARY_LLM_FAILED, FALLBACK_LLM_FAILED, ALL_LLMS_FAILED, MAINTENANCE_MODE
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 17.6, 18.5_
  
  - [x] 15.2 Write property test for LLM failure handling
    - **Property 14: LLM Failure Handling**
    - **Validates: Requirements 9.3, 9.4**
    - Simulate Primary_LLM failures
    - Verify session pauses and user notified
    - Simulate both LLMs failing
    - Verify maintenance mode triggered
    - Run with minimum 100 iterations
  
  - [x] 15.3 Write property test for no silent degradation
    - **Property 15: No Silent Degradation**
    - **Validates: Requirements 9.5**
    - Simulate various service failures
    - Verify user notification generated for each
    - Verify no degradation occurs without notification
    - Run with minimum 100 iterations
  
  - [x] 15.4 Write property test for recovery logging
    - **Property 16: Recovery Logging**
    - **Validates: Requirements 9.6**
    - Simulate service failures and recoveries
    - Verify recoveries logged
    - Verify normal operation resumes automatically
    - Run with minimum 100 iterations

- [x] 16. Implement integration layer
  - [x] 16.1 Create `backend/teach_back/integrations.py` with TeachBackIntegrations class
    - Implement `feed_to_flashcard_generator()` to send missed concepts for automatic flashcard suggestions
    - Implement `feed_to_weak_area_analysis()` to send error patterns and weak topics for personalized tracking
    - Implement `feed_to_study_planner()` to send personalized recommendations for study scheduling
    - Implement `feed_to_mcq_suggestions()` to send missed concepts for targeted MCQ practice
    - Use async calls with proper error handling and timeouts
    - Integration failures should NOT block session completion (loose coupling)
    - Use defined integration interfaces, not direct imports (maintain isolation)
    - Queue failed integrations for retry with exponential backoff
    - Log all integration attempts and failures
    - Ensure teach-back module does NOT modify internal implementation of existing systems
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_
  
  - [x] 16.2 Write property test for integration data propagation
    - **Property 18: Integration Data Propagation**
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4**
    - Generate random completed sessions with various data
    - Verify data sent to all integration endpoints
    - Verify integration failures don't affect sessions
    - Verify correct data format sent to each system
    - Run with minimum 100 iterations

- [x] 17. Implement data retention and cleanup
  - [x] 17.1 Create retention policy enforcement
    - Create configuration file `backend/config/teach_back_retention.json` for retention policies per plan
    - Implement automatic cleanup job that runs daily
    - Delete session data older than retention timeframe for user's plan
    - Preserve summary statistics after detail deletion
    - Log all deletions for audit purposes
    - Apply new retention policy when user plan changes
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_
  
  - [x] 17.2 Write property test for retention policy enforcement
    - **Property 19: Retention Policy Enforcement**
    - **Validates: Requirements 12.2, 12.4, 12.5**
    - Generate sessions with various ages and plans
    - Verify old data deleted based on plan retention
    - Verify summaries preserved after deletion
    - Verify deletions logged
    - Run with minimum 100 iterations
  
  - [x] 17.3 Write property test for retention policy updates
    - **Property 20: Retention Policy Updates**
    - **Validates: Requirements 12.3**
    - Generate users with plan changes
    - Verify new retention policy applied to existing data
    - Run with minimum 100 iterations

- [x] 18. Implement backend API endpoints
  - [x] 18.1 Create `backend/teach_back/routes.py` with FastAPI router
    - POST `/api/teach-back/sessions` - Create new session with input/output mode selection and rate limit validation
    - GET `/api/teach-back/sessions/{id}` - Get session details, current state, and context
    - POST `/api/teach-back/sessions/{id}/input` - Process user input (text or audio bytes)
    - POST `/api/teach-back/sessions/{id}/acknowledge` - Acknowledge interruption and return to teaching state
    - POST `/api/teach-back/sessions/{id}/end-teaching` - End teaching phase, transition to examining state
    - POST `/api/teach-back/sessions/{id}/end` - End session, generate summary, transition to completed state
    - GET `/api/teach-back/sessions/{id}/transcript` - Get full transcript with timestamps
    - GET `/api/teach-back/sessions` - List user's sessions with pagination and filtering
    - GET `/api/teach-back/quota` - Get remaining quota for current user (text and voice sessions)
    - Include authentication middleware (verify user identity)
    - Include rate limiting checks before session creation (enforce quota)
    - Return proper error responses with error codes (QUOTA_EXCEEDED, INVALID_STATE_TRANSITION, etc.)
    - Support admin controls: disable feature entirely, disable voice modes, override user quotas
    - _Requirements: 1.1, 1.2, 7.1, 8.3, 8.4, 8.5, 8.6_
  
  - [x] 18.2 Write unit tests for API endpoints
    - Test each endpoint with valid inputs
    - Test authentication requirements
    - Test rate limiting enforcement
    - Test error responses with proper error codes
    - Test admin controls (disable feature, disable voice, override quotas)
    - Test pagination for session listing

- [x] 19. Checkpoint - Ensure backend API works end-to-end
  - Test all API endpoints with Postman or similar
  - Verify authentication and rate limiting
  - Test complete session flow via API
  - Ask the user if questions arise

- [x] 20. Implement frontend UI components
  - [x] 20.1 Create `frontend/pages/teach-back.tsx` directory structure
    - Create `page.tsx` as main teach-back page with session initialization and mode selection
    - Create `components/ModeSelector.tsx` for input/output mode selection UI (Text Only, Voice Only, Text+Voice Mixed for input; Text Only, Voice+Text for output)
    - Create `components/LiveTranscript.tsx` for real-time transcript display with auto-scroll and speaker identification
    - Create `components/InterruptionIndicator.tsx` for visual interruption alerts with correction display
    - Create `components/SessionSummary.tsx` for end-of-session summary display (errors, missed concepts, strong areas, recommendations, scores)
    - Create `components/VoiceControls.tsx` for voice recording start/stop with visual feedback
    - Create `components/ExaminationView.tsx` for Q&A examination phase with question display and answer input
    - Create `hooks/useTeachBackSession.ts` for session state management and API integration
    - Ensure UI is separate from chat interface (distinct entry point)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_
  
  - [x] 20.2 Write unit tests for UI components
    - Test mode selector renders all options (Text Only, Voice Only, Text+Voice Mixed, Voice+Text)
    - Test transcript displays entries correctly with timestamps
    - Test interruption indicator appears on interruptions
    - Test summary displays all required elements (errors, missed concepts, recommendations, scores)
    - Test session hook manages state correctly
    - Test voice controls enable/disable based on mode
    - Test examination view displays questions and accepts answers
    - Create `components/SessionSummary.tsx` for end-of-session summary display (errors, missed concepts, strong areas, recommendations, scores)
    - Create `components/VoiceControls.tsx` for voice recording start/stop with visual feedback
    - Create `components/ExaminationView.tsx` for Q&A examination phase with question display and answer input
    - Create `hooks/useTeachBackSession.ts` for session state management and API integration
    - Ensure UI is separate from chat interface (distinct entry point)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_
  
  - [ ] 20.2 Write unit tests for UI components
    - Test mode selector renders all options (Text Only, Voice Only, Text+Voice Mixed, Voice+Text)
    - Test transcript displays entries correctly with timestamps
    - Test interruption indicator appears on interruptions
    - Test summary displays all required elements (errors, missed concepts, recommendations, scores)
    - Test session hook manages state correctly
    - Test voice controls enable/disable based on mode
    - Test examination view displays questions and accepts answers

- [x] 21. Implement frontend session flow
  - [x] 21.1 Wire up frontend components to backend API
    - Implement session creation with mode selection
    - Implement text input submission with real-time response display
    - Implement voice input recording and submission (if voice mode selected)
    - Implement real-time transcript updates via polling or WebSocket
    - Implement interruption handling and acknowledgment flow
    - Implement examination Q&A flow with question display and answer submission
    - Implement session end and summary display
    - Handle all error responses with user-friendly messages
    - Display quota information when quota exceeded
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 7.7_

- [x] 22. Implement voice recording in frontend
  - [x] 22.1 Add voice recording functionality
    - Use Web Audio API (MediaRecorder) to capture microphone input
    - Implement start/stop recording controls with clear visual feedback (recording indicator)
    - Convert audio to format expected by backend (WAV or MP3 with proper encoding)
    - Send audio bytes to backend STT endpoint for transcription
    - Display transcribed text in real-time as it arrives from backend
    - Handle microphone permission errors with clear user messaging
    - Implement continuous voice input support (no manual activation per utterance required)
    - Handle poor audio quality errors (AUDIO_QUALITY_POOR) with user prompt to repeat
    - Note: Voice features require HTTPS for microphone access
    - _Requirements: 17.1, 17.2, 17.4, 17.5_

- [x] 23. Implement audio playback in frontend
  - [x] 23.1 Add audio playback for voice output mode
    - Receive audio from backend TTS endpoint
    - Play audio while displaying text simultaneously
    - Implement pause/stop controls for audio playback
    - Handle audio playback errors gracefully (continue with text)
    - Use natural, conversational voice settings
    - _Requirements: 18.1, 18.3, 18.4, 18.6_

- [x] 24. Add admin controls to admin panel
  - [x] 24.1 Create teach-back admin section
    - Add toggle to enable/disable teach-back feature entirely (TEACH_BACK_ENABLED)
    - Add toggle to enable/disable voice modes specifically (TEACH_BACK_VOICE_ENABLED)
    - Add interface to override rate limits for specific users
    - Add view of teach-back usage statistics (sessions per day, voice vs text)
    - Add view of teach-back error logs with filtering by error code
    - Add view of LLM failover statistics
    - Add maintenance mode status indicator
    - _Requirements: 8.3, 8.4, 8.5_

- [x] 25. Checkpoint - Ensure complete frontend works
  - Test full user flow in browser
  - Test text-only mode end-to-end
  - Test voice mode end-to-end (if voice enabled)
  - Test error handling and fallbacks
  - Test admin controls
  - Ask the user if questions arise

- [x] 26. Add configuration management
  - [x] 26.1 Create configuration files and environment setup
    - Create `backend/config/teach_back_limits.json` with rate limits per plan (free: 0 sessions, student: 5 text/2 voice, pro: 20 text/10 voice, admin: unlimited)
    - Create `backend/config/teach_back_retention.json` with retention policies per plan (days to retain detailed session data)
    - Update `backend/models.json` to include teach_back section with primary LLM config (provider, model, API key reference) and fallback LLM config (m42-health/Llama3-Med42-70B via Hugging Face)
    - Add environment variables: LOCAL_MODELS_DIR (default: /local_models), TEACH_BACK_ENABLED (default: true), TEACH_BACK_VOICE_ENABLED (default: true)
    - Add environment variables for LLM API keys: TEACH_BACK_PRIMARY_LLM_KEY, TEACH_BACK_FALLBACK_LLM_KEY (separate from other features)
    - Add integration endpoint environment variables: FLASHCARD_SERVICE_URL, WEAK_AREA_SERVICE_URL, STUDY_PLANNER_SERVICE_URL, MCQ_SERVICE_URL
    - Implement configuration validation on load with error logging for invalid values (missing keys, wrong types, out of range)
    - Load all configurations at startup and apply changes without requiring code deployment
    - _Requirements: 5.1, 5.2, 5.3, 5.6, 6.4, 8.1, 8.2, 8.3, 8.4, 12.1, 20.1, 20.2, 20.3, 20.4, 20.5, 20.6_
  
  - [x] 26.2 Write property test for configuration validation
    - **Property 29: Configuration Validation**
    - **Validates: Requirements 20.6**
    - Generate random invalid configurations (missing keys, wrong types, invalid values)
    - Verify they are rejected at load time
    - Verify errors logged with details
    - Run with minimum 100 iterations

- [x] 27. Create model download script
  - [x] 27.1 Create `scripts/download_teach_back_models.sh`
    - Download Whisper-large-v3 to `${LOCAL_MODELS_DIR}/stt/whisper-large-v3` using huggingface-cli
    - Download Piper TTS binary to `${LOCAL_MODELS_DIR}/tts/piper` from GitHub releases (v1.2.0 or later)
    - Download Piper voice model (en_US-lessac-medium.onnx and .onnx.json) from Hugging Face rhasspy/piper-voices
    - Verify downloads completed successfully with checksums or file size validation
    - Make script idempotent (skip if already downloaded, check for existing files)
    - Add progress indicators for large downloads (Whisper is ~3GB)
    - Set proper permissions on downloaded files
    - Note: Whisper-large-v3 requires ~10GB RAM for inference
    - _Requirements: 5.4, 5.5, 6.1, 6.2, 6.3_

- [x] 28. Update Docker configuration
  - [x] 28.1 Update Dockerfile for teach-back support
    - Add audio processing system dependencies (ffmpeg, libsndfile1, libportaudio2, libasound2-dev)
    - Add Python audio libraries to requirements.txt (openai-whisper, piper-tts, soundfile, librosa, pyaudio)
    - Create `/local_models/` directory structure with stt/ and tts/ subdirectories
    - Set LOCAL_MODELS_DIR environment variable to /local_models
    - Add model download step in Dockerfile OR configure volume mount for models (volume mount preferred for size)
    - Increase memory allocation for Whisper-large-v3 (requires ~10GB RAM for inference)
    - Add health check for voice processor availability
    - Ensure proper permissions on /local_models directory
    - _Requirements: 5.4, 5.5, 6.1, 6.2, 6.3, 6.4_

- [x] 29. Write deployment documentation
  - [x] 29.1 Create deployment guide in `docs/teach_back_deployment.md`
    - Document all required environment variables with examples and default values
    - Document model download process and storage requirements (~13GB total: 3GB Whisper + 10GB RAM)
    - Document database migration steps with rollback procedure (include SQL rollback script)
    - Document configuration file setup and validation (teach_back_limits.json, teach_back_retention.json, models.json)
    - Document Hugging Face Spaces deployment specifics (spaces.yml configuration, resource limits, secrets management)
    - Document monitoring and alerting setup (key metrics: session creation rate, error rate, LLM failover rate, voice processing success rate; alert thresholds)
    - Document rollback procedure (feature flag disable via TEACH_BACK_ENABLED=false, database rollback, code rollback)
    - Document troubleshooting common issues (STT/TTS failures, LLM failover, quota issues, maintenance mode, audio quality problems)
    - Document integration setup with existing systems (flashcards, weak areas, study planner, MCQs)
    - Document admin controls and their effects (disable feature, disable voice, override quotas)

- [x] 30. Final integration testing
  - [x] 30.1 Run complete end-to-end test suite
    - Test complete text-only session flow (teaching → interruption → examination → summary) with all data persisted
    - Test complete voice session flow with all voice modes (Voice Only input, Text+Voice Mixed input, Voice+Text output)
    - Test session with STT failure mid-session (verify automatic fallback to text input with user notification)
    - Test session with TTS failure mid-session (verify automatic fallback to text output with user notification)
    - Test session with LLM failover (primary fails, fallback succeeds, no user intervention required)
    - Test session with both LLMs failing (verify maintenance mode triggered, new sessions prevented)
    - Test session hitting quota limit (verify rejection with quota info, suggest plan upgrade)
    - Test all integrations with other systems (flashcards receive missed concepts, weak areas receive error patterns, study planner receives recommendations, MCQs receive missed concepts)
    - Test admin controls (feature disable via TEACH_BACK_ENABLED, voice disable via TEACH_BACK_VOICE_ENABLED, quota overrides for specific users)
    - Test data retention cleanup job (verify old data deleted, summaries preserved, deletions logged)
    - Test state machine transitions (all valid transitions succeed, invalid transitions rejected)
    - Test error handling for all error codes (proper error responses, user notifications, logging)
  
  - [x] 30.2 Run all property-based tests
    - Run all 29 property tests with minimum 100 iterations each
    - Verify all properties pass consistently across all iterations
    - Fix any failures discovered during property testing
    - Document any edge cases found and how they were handled
    - Verify test coverage meets target (80%+ for unit tests, 100% for properties)

- [x] 31. Final checkpoint - Production readiness
  - Verify all tests pass (unit and property)
  - Verify code coverage meets target (80%+)
  - Verify no hardcoded paths or secrets
  - Verify error handling comprehensive
  - Verify logging adequate for debugging
  - Verify documentation complete
  - Ask the user if ready for deployment

## Notes

- All tasks including property-based tests are mandatory for proper functioning and testing
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and provide opportunities for user feedback
- The isolated module design (`backend/teach_back/`) ensures the feature can be developed, tested, and removed independently
- Property tests validate universal correctness properties across all inputs (minimum 100 iterations each)
- Unit tests validate specific examples, edge cases, and integration points
- Voice processing requires local models to be downloaded before testing (~3GB Whisper-large-v3, ~10GB RAM for inference)
- LLM configuration requires dedicated API keys separate from other features (TEACH_BACK_PRIMARY_LLM_KEY, TEACH_BACK_FALLBACK_LLM_KEY)
- Frontend voice features require HTTPS for microphone access (Web Audio API requirement)
- All 29 correctness properties from the design document are implemented as property-based tests
- Configuration uses environment variables and JSON files, not hardcoded values (enables deployment without code changes)
- The teach_back module can be removed without affecting core application functionality (loose coupling via integration interfaces)
- Rate limiting is independent from other features (separate quota tracking in teach_back_usage table)
- Data retention policies are configurable per subscription plan (automatic cleanup with summary preservation)
- Graceful degradation ensures sessions continue even when voice services fail (automatic fallback to text mode)
- Maintenance mode prevents new sessions when all LLM providers fail (existing sessions can complete)
- All state transitions are logged with timestamps for debugging and audit purposes
- Integration failures do not block session completion (async retry with exponential backoff)
- Error responses follow consistent format with machine-readable codes and human-readable messages
