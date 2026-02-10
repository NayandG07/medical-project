# Requirements Document: Interactive Learning Assistant (Teach-Back Mode)

## Introduction

The Interactive Learning Assistant (Teach-Back Mode) is a standalone feature that enables medical students to teach concepts back to an AI tutor through voice and/or text input. The system actively listens, detects conceptual errors, provides gentle corrections through interruptions, and conducts an oral-style examination at the end of each session. This feature simulates the experience of teaching to a junior medical student or participating in an OSCE (Objective Structured Clinical Examination) oral examination.

## Glossary

- **Teach_Back_System**: The complete interactive learning assistant feature module
- **Session**: A single teach-back interaction from start to end, including teaching phase and examination phase
- **Student_Persona**: Internal AI role that acts as the learner being taught (hidden from user)
- **Evaluator**: Internal AI role that detects errors and triggers interruptions (hidden from user)
- **Controller**: Internal AI role that manages session flow and state transitions (hidden from user)
- **Examiner**: Internal AI role that conducts the oral examination at session end (hidden from user)
- **Interruption**: A gentle correction provided by the system when an error is detected
- **Transcript**: Complete text record of all user input and system responses in a session
- **Input_Mode**: User-selected method for providing content (Text, Voice, or Mixed)
- **Output_Mode**: User-selected method for receiving feedback (Text or Voice+Text)
- **Primary_LLM**: The main language model configured via new API key pair in models.json
- **Fallback_LLM**: The m42-health/Llama3-Med42-70B model accessed via Hugging Face
- **STT_Engine**: Speech-to-text engine (Whisper-large-v3)
- **TTS_Engine**: Text-to-speech engine (Piper TTS)
- **Local_Models_Directory**: The /local_models/ directory containing stt/ and tts/ subdirectories
- **Session_State**: Current phase of the session (teaching, interrupted, examining, completed)
- **Error_Detection**: Process of identifying conceptual mistakes in user's teaching
- **Weak_Area**: A concept or topic where the user demonstrated insufficient understanding
- **Rate_Quota**: Usage limits specific to teach-back sessions, independent from other features
- **Maintenance_Mode**: System state when all providers fail, preventing new sessions

## Requirements

### Requirement 1: Input and Output Mode Selection

**User Story:** As a medical student, I want to choose how I provide my teaching (text, voice, or both) and how I receive feedback (text or voice+text), so that I can learn in the way that suits my current environment and preferences.

#### Acceptance Criteria

1. WHEN a user starts a new teach-back session, THE Teach_Back_System SHALL display input mode options: Text Only, Voice Only, and Text+Voice Mixed
2. WHEN a user starts a new teach-back session, THE Teach_Back_System SHALL display output mode options: Text Only and Voice+Text
3. WHEN a user selects an input mode, THE Teach_Back_System SHALL configure the session to accept input via the selected method
4. WHEN a user selects an output mode, THE Teach_Back_System SHALL configure the session to provide feedback via the selected method
5. WHEN a user selects Voice Only or Text+Voice Mixed input mode, THE Teach_Back_System SHALL activate the STT_Engine
6. WHEN a user selects Voice+Text output mode, THE Teach_Back_System SHALL activate the TTS_Engine

### Requirement 2: Transcript Generation

**User Story:** As a medical student, I want a complete text transcript of every teach-back session, so that I can review what I taught and what corrections were made.

#### Acceptance Criteria

1. THE Teach_Back_System SHALL generate a complete text transcript for every session regardless of input or output mode
2. WHEN voice input is provided, THE Teach_Back_System SHALL convert it to text and include it in the transcript
3. WHEN the system provides an interruption or feedback, THE Teach_Back_System SHALL include the full text in the transcript
4. WHEN a session completes, THE Teach_Back_System SHALL store the complete transcript with the session data
5. THE Teach_Back_System SHALL include timestamps for each transcript entry

### Requirement 3: Backend Architecture Isolation

**User Story:** As a system architect, I want the teach-back feature to be completely isolated from other features, so that it can be maintained, modified, or removed without affecting the core application.

#### Acceptance Criteria

1. THE Teach_Back_System SHALL be implemented in a dedicated teach_back/ module directory
2. THE Teach_Back_System SHALL use its own session model distinct from other feature sessions
3. THE Teach_Back_System SHALL implement its own state machine for session flow management
4. THE Teach_Back_System SHALL maintain its own rate limiting configuration independent from other features
5. WHEN the teach_back/ module is removed, THE core application SHALL continue functioning without errors
6. THE Teach_Back_System SHALL NOT modify or depend on session models from other features

### Requirement 4: Internal Role Architecture

**User Story:** As a system designer, I want the AI to use multiple internal roles to simulate realistic teaching interactions, so that the experience feels like teaching to a real person rather than a chatbot.

#### Acceptance Criteria

1. THE Teach_Back_System SHALL implement a Student_Persona role that acts as the learner being taught
2. THE Teach_Back_System SHALL implement an Evaluator role that detects conceptual errors in real-time
3. THE Teach_Back_System SHALL implement a Controller role that manages session state transitions
4. THE Teach_Back_System SHALL implement an Examiner role that conducts the oral examination phase
5. THE Teach_Back_System SHALL NOT expose internal role names or architecture to the user interface
6. WHEN generating responses, THE Teach_Back_System SHALL use the appropriate role based on current session state

### Requirement 5: Model Configuration and Fallback

**User Story:** As a system administrator, I want the teach-back feature to use dedicated LLM resources with automatic fallback, so that it doesn't compete with other features and maintains availability.

#### Acceptance Criteria

1. THE Teach_Back_System SHALL use a Primary_LLM configured via a new API key pair in models.json
2. WHEN the Primary_LLM is unavailable or fails, THE Teach_Back_System SHALL automatically switch to the Fallback_LLM
3. THE Teach_Back_System SHALL use m42-health/Llama3-Med42-70B via Hugging Face as the Fallback_LLM
4. THE Teach_Back_System SHALL use Whisper-large-v3 as the STT_Engine for voice input processing
5. THE Teach_Back_System SHALL use Piper TTS as the TTS_Engine for voice output generation
6. THE Teach_Back_System SHALL NOT share LLM API keys or quotas with other application features

### Requirement 6: Local Model Storage

**User Story:** As a deployment engineer, I want all local models stored in a consistent directory structure, so that the application can be deployed to Hugging Face Spaces without path conflicts.

#### Acceptance Criteria

1. THE Teach_Back_System SHALL store all local models in the Local_Models_Directory at /local_models/
2. THE Teach_Back_System SHALL store STT models in /local_models/stt/ subdirectory
3. THE Teach_Back_System SHALL store TTS models in /local_models/tts/ subdirectory
4. THE Teach_Back_System SHALL load model paths from configuration files, not hardcoded values
5. WHEN a model is loaded, THE Teach_Back_System SHALL construct the path relative to the Local_Models_Directory
6. THE Teach_Back_System SHALL NOT scatter model files across multiple directory locations

### Requirement 7: Frontend User Interface

**User Story:** As a medical student, I want a dedicated interface for teach-back sessions that shows my progress and feedback in real-time, so that I can focus on teaching without distractions.

#### Acceptance Criteria

1. THE Teach_Back_System SHALL provide a separate UI entry point distinct from the chat interface
2. THE Teach_Back_System SHALL display input mode selector controls in the session UI
3. THE Teach_Back_System SHALL display output mode selector controls in the session UI
4. THE Teach_Back_System SHALL display a live transcript view showing all teaching content and feedback
5. THE Teach_Back_System SHALL display visual indicators when an interruption occurs
6. WHEN a session ends, THE Teach_Back_System SHALL display a summary view with detected errors, missed concepts, and recommendations
7. THE Teach_Back_System SHALL NOT reuse or modify the existing chat UI components

### Requirement 8: Rate Limiting and Plan Management

**User Story:** As a system administrator, I want independent rate limits for teach-back sessions with different costs for voice versus text, so that I can manage resource usage effectively.

#### Acceptance Criteria

1. THE Teach_Back_System SHALL enforce Rate_Quota limits independent from other feature quotas
2. WHEN a voice-based session is created, THE Teach_Back_System SHALL deduct more quota than a text-only session
3. THE Teach_Back_System SHALL allow administrators to disable the teach-back feature entirely
4. THE Teach_Back_System SHALL allow administrators to disable voice modes while keeping text mode available
5. THE Teach_Back_System SHALL allow administrators to override rate limits for specific users
6. WHEN a user exceeds their Rate_Quota, THE Teach_Back_System SHALL prevent new session creation and display quota information

### Requirement 9: Failure Handling and Degradation

**User Story:** As a medical student, I want the system to gracefully handle failures by falling back to available modes, so that I can continue my learning session even when some services are unavailable.

#### Acceptance Criteria

1. WHEN the STT_Engine fails, THE Teach_Back_System SHALL automatically switch to text-only input mode and notify the user
2. WHEN the TTS_Engine fails, THE Teach_Back_System SHALL automatically switch to text-only output mode and notify the user
3. WHEN the Primary_LLM fails, THE Teach_Back_System SHALL pause the session and notify the user with retry options
4. WHEN both Primary_LLM and Fallback_LLM fail, THE Teach_Back_System SHALL enter Maintenance_Mode and prevent new sessions
5. THE Teach_Back_System SHALL NOT silently degrade functionality without user notification
6. WHEN a service recovers from failure, THE Teach_Back_System SHALL log the recovery and resume normal operation

### Requirement 10: Session Data Storage

**User Story:** As a medical student, I want the system to remember what errors I made and what concepts I struggled with, so that I can receive personalized study recommendations.

#### Acceptance Criteria

1. THE Teach_Back_System SHALL store the complete transcript for each session
2. THE Teach_Back_System SHALL store all detected errors with their context and corrections
3. THE Teach_Back_System SHALL store all missed concepts identified during the session
4. THE Teach_Back_System SHALL store all interruption points with timestamps and reasons
5. THE Teach_Back_System SHALL store the complete examiner Q&A exchange from the examination phase
6. THE Teach_Back_System SHALL store personalized recommendations generated at session end
7. WHEN a session completes, THE Teach_Back_System SHALL persist all session data to the database

### Requirement 11: Data Integration with Existing Systems

**User Story:** As a system architect, I want teach-back session data to feed into existing learning systems, so that students receive comprehensive personalized recommendations across all features.

#### Acceptance Criteria

1. THE Teach_Back_System SHALL provide session data to the flashcard generator system
2. THE Teach_Back_System SHALL provide Weak_Area data to the weak-area analysis system
3. THE Teach_Back_System SHALL provide session data to the study planner system
4. THE Teach_Back_System SHALL provide missed concepts to the MCQ suggestion system
5. THE Teach_Back_System SHALL NOT modify the internal implementation of existing systems
6. WHEN providing data to other systems, THE Teach_Back_System SHALL use defined integration interfaces

### Requirement 12: Data Retention and Cleanup

**User Story:** As a system administrator, I want automatic data cleanup based on user subscription plans, so that storage costs remain manageable and comply with retention policies.

#### Acceptance Criteria

1. THE Teach_Back_System SHALL define data retention timeframes for each subscription plan
2. THE Teach_Back_System SHALL automatically delete session data older than the retention timeframe
3. WHEN a user's plan changes, THE Teach_Back_System SHALL apply the new retention policy to their existing data
4. THE Teach_Back_System SHALL preserve summary statistics even after detailed session data is deleted
5. THE Teach_Back_System SHALL log all automatic data deletions for audit purposes

### Requirement 13: Error Detection and Interruption

**User Story:** As a medical student, I want the system to interrupt me when I make a conceptual error, so that I can correct my understanding immediately rather than reinforcing incorrect knowledge.

#### Acceptance Criteria

1. WHEN the Evaluator detects a conceptual error, THE Teach_Back_System SHALL generate an interruption
2. THE Teach_Back_System SHALL provide gentle, constructive corrections in interruptions
3. THE Teach_Back_System SHALL include the correct information in the interruption response
4. WHEN an interruption occurs, THE Teach_Back_System SHALL update the Session_State to interrupted
5. WHEN the user acknowledges an interruption, THE Teach_Back_System SHALL return Session_State to teaching
6. THE Teach_Back_System SHALL record all interruptions with their triggering errors in session data

### Requirement 14: Oral Examination Phase

**User Story:** As a medical student, I want to be examined on what I taught at the end of each session, so that I can verify my understanding and identify gaps in my knowledge.

#### Acceptance Criteria

1. WHEN a user ends the teaching phase, THE Teach_Back_System SHALL transition to the examination phase
2. THE Teach_Back_System SHALL use the Examiner role to generate questions based on taught content
3. THE Teach_Back_System SHALL ask questions about concepts that were taught incorrectly or incompletely
4. THE Teach_Back_System SHALL evaluate user responses to examination questions
5. WHEN the examination is complete, THE Teach_Back_System SHALL generate a summary of performance
6. THE Teach_Back_System SHALL store all examination questions and answers in the session data

### Requirement 15: User Experience Quality

**User Story:** As a medical student, I want the interaction to feel like teaching a real person and being examined by a real tutor, so that I can practice my communication and teaching skills authentically.

#### Acceptance Criteria

1. THE Teach_Back_System SHALL generate responses that simulate a junior medical student learning from the user
2. THE Teach_Back_System SHALL ask clarifying questions when the user's explanation is unclear
3. THE Teach_Back_System SHALL provide feedback that feels conversational and supportive
4. THE Teach_Back_System SHALL NOT generate responses that feel like a chatbot or dictation software
5. WHEN conducting the examination, THE Teach_Back_System SHALL simulate an OSCE examiner's questioning style
6. THE Teach_Back_System SHALL maintain consistent persona characteristics throughout the session

### Requirement 16: Session State Management

**User Story:** As a system developer, I want clear session state transitions, so that the system behavior is predictable and debuggable.

#### Acceptance Criteria

1. THE Teach_Back_System SHALL initialize new sessions in the teaching state
2. WHEN an error is detected, THE Teach_Back_System SHALL transition to the interrupted state
3. WHEN an interruption is resolved, THE Teach_Back_System SHALL transition back to the teaching state
4. WHEN the user ends teaching, THE Teach_Back_System SHALL transition to the examining state
5. WHEN the examination completes, THE Teach_Back_System SHALL transition to the completed state
6. THE Teach_Back_System SHALL log all state transitions with timestamps

### Requirement 17: Voice Input Processing

**User Story:** As a medical student, I want to teach using my voice, so that I can practice explaining concepts verbally as I would in a real clinical setting.

#### Acceptance Criteria

1. WHEN Voice Only or Text+Voice Mixed mode is active, THE Teach_Back_System SHALL capture audio input
2. THE Teach_Back_System SHALL process audio input through the STT_Engine to generate text
3. THE Teach_Back_System SHALL include the transcribed text in the session transcript
4. WHEN audio quality is poor, THE Teach_Back_System SHALL request the user to repeat
5. THE Teach_Back_System SHALL support continuous voice input without requiring manual activation per utterance
6. WHEN voice input processing fails, THE Teach_Back_System SHALL fall back to text input mode

### Requirement 18: Voice Output Generation

**User Story:** As a medical student, I want to hear the system's feedback spoken aloud, so that I can maintain eye contact with my notes or practice materials while receiving corrections.

#### Acceptance Criteria

1. WHEN Voice+Text output mode is active, THE Teach_Back_System SHALL generate audio output for all responses
2. THE Teach_Back_System SHALL process response text through the TTS_Engine to generate audio
3. THE Teach_Back_System SHALL display the text simultaneously with playing the audio
4. THE Teach_Back_System SHALL allow users to pause or stop audio playback
5. WHEN audio playback fails, THE Teach_Back_System SHALL continue displaying text output
6. THE Teach_Back_System SHALL use a natural, conversational voice for TTS output

### Requirement 19: Session Summary Generation

**User Story:** As a medical student, I want a comprehensive summary at the end of each session, so that I know what I did well and what I need to study further.

#### Acceptance Criteria

1. WHEN a session completes, THE Teach_Back_System SHALL generate a summary of all detected errors
2. WHEN a session completes, THE Teach_Back_System SHALL generate a list of missed concepts
3. WHEN a session completes, THE Teach_Back_System SHALL generate personalized study recommendations
4. WHEN a session completes, THE Teach_Back_System SHALL include examination performance metrics
5. THE Teach_Back_System SHALL display the summary in the session UI
6. THE Teach_Back_System SHALL allow users to download or save the session summary

### Requirement 20: Configuration Management

**User Story:** As a system administrator, I want all teach-back configuration centralized and documented, so that I can easily adjust settings without code changes.

#### Acceptance Criteria

1. THE Teach_Back_System SHALL store all model configurations in models.json
2. THE Teach_Back_System SHALL store rate limit configurations in a dedicated configuration file
3. THE Teach_Back_System SHALL store retention policies in a dedicated configuration file
4. THE Teach_Back_System SHALL load all configurations at startup
5. WHEN configuration changes are made, THE Teach_Back_System SHALL apply them without requiring code deployment
6. THE Teach_Back_System SHALL validate all configuration values at load time and log errors for invalid values
