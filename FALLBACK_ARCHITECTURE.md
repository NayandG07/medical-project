# VaidyaAI Fallback Architecture

## System Architecture with Medical Model Fallback

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER REQUEST                             │
│                    "Explain diabetes mellitus"                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js)                          │
│                  POST /api/chat/sessions/{id}/messages           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND API GATEWAY                           │
│                      (FastAPI)                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Auth Check   │→ │ Rate Limiter │→ │ Chat Service │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MODEL ROUTER                                │
│                  (Intelligent Fallback Logic)                    │
│                                                                   │
│  Step 1: Check User's Personal API Key                          │
│  ┌─────────────────────────────────────┐                        │
│  │ User has personal key?              │                        │
│  │ ├─ Yes → Try user's key first       │                        │
│  │ └─ No  → Use shared keys            │                        │
│  └─────────────────────────────────────┘                        │
│                     │                                            │
│                     ▼                                            │
│  Step 2: Try Paid API Keys (Priority Order)                     │
│  ┌─────────────────────────────────────┐                        │
│  │ Priority 1: Claude Sonnet 4.5       │ ──┐                    │
│  │ Priority 2: Gemini 3 Flash          │   │                    │
│  │ Priority 3: GPT-5                   │   │                    │
│  └─────────────────────────────────────┘   │                    │
│                     │                       │                    │
│                     │ All Failed?           │                    │
│                     ▼                       │                    │
│  Step 3: Hugging Face Medical Models       │                    │
│  ┌─────────────────────────────────────┐   │                    │
│  │ Feature: chat                       │   │                    │
│  │ Model: Meditron-7B                  │   │                    │
│  │ (Medical-specific, FREE)            │   │                    │
│  └─────────────────────────────────────┘   │                    │
│                     │                       │                    │
│                     │ Success?              │                    │
│                     ▼                       │                    │
│  Step 4: Log Everything                     │                    │
│  ┌─────────────────────────────────────┐   │                    │
│  │ Model Usage Logger                  │◄──┘                    │
│  │ - Provider, Model, Feature          │                        │
│  │ - Success/Failure                   │                        │
│  │ - Tokens Used                       │                        │
│  │ - Was Fallback?                     │                        │
│  │ - Response Time                     │                        │
│  └─────────────────────────────────────┘                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE (Supabase)                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ model_usage_logs                                         │  │
│  │ ┌────────────────────────────────────────────────────┐   │  │
│  │ │ id, user_id, provider, model, feature              │   │  │
│  │ │ success, tokens_used, error                        │   │  │
│  │ │ was_fallback, attempt_number, response_time_ms     │   │  │
│  │ │ timestamp                                           │   │  │
│  │ └────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN DASHBOARD                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Model Usage Statistics                                   │  │
│  │ ┌────────────┐ ┌────────────┐ ┌────────────┐            │  │
│  │ │Total Calls │ │Success Rate│ │Fallback Rate│           │  │
│  │ │   1,250    │ │   94.4%    │ │    3.6%    │            │  │
│  │ └────────────┘ └────────────┘ └────────────┘            │  │
│  │                                                           │  │
│  │ Usage by Provider:                                       │  │
│  │ ┌─────────────────────────────────────────────────────┐ │  │
│  │ │ OpenRouter (Claude): 1,100 calls, 420K tokens      │ │  │
│  │ │ Hugging Face (Meditron): 150 calls, 30K tokens     │ │  │
│  │ └─────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │ Recent Fallbacks:                                        │  │
│  │ ┌─────────────────────────────────────────────────────┐ │  │
│  │ │ 10:30 AM - chat → Meditron-7B (Claude failed)      │ │  │
│  │ │ 10:25 AM - mcq → Llama-3-8B (Gemini failed)        │ │  │
│  │ └─────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Fallback Decision Tree

```
                    ┌─────────────────┐
                    │  User Request   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Has Personal    │
                    │ API Key?        │
                    └────┬───────┬────┘
                         │       │
                    Yes  │       │  No
                         │       │
                         ▼       ▼
              ┌──────────────┐  ┌──────────────┐
              │ Try User Key │  │ Get Shared   │
              └──────┬───────┘  │ Keys         │
                     │          └──────┬───────┘
                     │                 │
                     │ Failed          │
                     ▼                 ▼
              ┌──────────────────────────────┐
              │ Try Priority 1 Shared Key    │
              │ (Claude Sonnet 4.5)          │
              └──────────┬───────────────────┘
                         │
                         │ Failed
                         ▼
              ┌──────────────────────────────┐
              │ Try Priority 2 Shared Key    │
              │ (Gemini 3 Flash)             │
              └──────────┬───────────────────┘
                         │
                         │ Failed
                         ▼
              ┌──────────────────────────────┐
              │ Try Priority 3 Shared Key    │
              │ (GPT-5)                      │
              └──────────┬───────────────────┘
                         │
                         │ All Failed
                         ▼
              ┌──────────────────────────────┐
              │ FALLBACK: Hugging Face       │
              │ Medical Models               │
              │                              │
              │ • Meditron-7B (medical)      │
              │ • Llama-3-8B (content)       │
              │ • Mistral-7B (summary)       │
              └──────────┬───────────────────┘
                         │
                    Success │ Failed
                         │       │
                         ▼       ▼
              ┌──────────────┐  ┌──────────────┐
              │ Return       │  │ Maintenance  │
              │ Response     │  │ Mode         │
              └──────────────┘  └──────────────┘
                         │
                         ▼
              ┌──────────────────────────────┐
              │ Log to Database              │
              │ • Provider, Model            │
              │ • Success/Failure            │
              │ • Tokens, Response Time      │
              │ • Was Fallback?              │
              └──────────────────────────────┘
```

## Medical Models Mapping

```
┌─────────────────────────────────────────────────────────────────┐
│                    FEATURE → MODEL MAPPING                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  CHAT & REASONING                                                │
│  ┌────────────────┐         ┌────────────────┐                  │
│  │ Primary:       │  ──→    │ Fallback:      │                  │
│  │ Claude Sonnet  │  fails  │ Meditron-7B    │                  │
│  │ 4.5            │         │ (Medical)      │                  │
│  └────────────────┘         └────────────────┘                  │
│                                                                   │
│  CONTENT GENERATION (Flashcards, MCQs, Maps)                    │
│  ┌────────────────┐         ┌────────────────┐                  │
│  │ Primary:       │  ──→    │ Fallback:      │                  │
│  │ Claude Sonnet  │  fails  │ Llama-3-8B     │                  │
│  │ 4.5            │         │ Instruct       │                  │
│  └────────────────┘         └────────────────┘                  │
│                                                                   │
│  SUMMARIZATION (High-Yield)                                      │
│  ┌────────────────┐         ┌────────────────┐                  │
│  │ Primary:       │  ──→    │ Fallback:      │                  │
│  │ Claude Haiku   │  fails  │ Mistral-7B     │                  │
│  │ 4.5            │         │ Instruct       │                  │
│  └────────────────┘         └────────────────┘                  │
│                                                                   │
│  CLINICAL REASONING & OSCE                                       │
│  ┌────────────────┐         ┌────────────────┐                  │
│  │ Primary:       │  ──→    │ Fallback:      │                  │
│  │ Claude Opus    │  fails  │ Meditron-7B    │                  │
│  │ 4.5            │         │ (Medical)      │                  │
│  └────────────────┘         └────────────────┘                  │
│                                                                   │
│  EMBEDDINGS (RAG)                                                │
│  ┌────────────────┐         ┌────────────────┐                  │
│  │ Primary:       │  ──→    │ Fallback:      │                  │
│  │ OpenAI         │  fails  │ bge-small      │                  │
│  │ Embeddings     │         │ en-v1.5        │                  │
│  └────────────────┘         └────────────────┘                  │
│                                                                   │
│  MEDICAL IMAGES                                                  │
│  ┌────────────────┐         ┌────────────────┐                  │
│  │ Primary:       │  ──→    │ Fallback:      │                  │
│  │ GPT-5 Image    │  fails  │ BiomedCLIP     │                  │
│  └────────────────┘         └────────────────┘                  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow: Successful Request

```
1. User Request
   ↓
2. Frontend → Backend API
   ↓
3. Model Router: Try Claude Sonnet 4.5
   ↓
4. OpenRouter API Call
   ↓ SUCCESS ✓
5. Log to Database:
   {
     provider: "openrouter",
     model: "claude-sonnet-4.5",
     feature: "chat",
     success: true,
     tokens_used: 250,
     was_fallback: false,
     attempt_number: 1,
     response_time_ms: 800
   }
   ↓
6. Return Response to User
```

## Data Flow: Fallback Scenario

```
1. User Request
   ↓
2. Frontend → Backend API
   ↓
3. Model Router: Try Claude Sonnet 4.5
   ↓
4. OpenRouter API Call
   ↓ FAILED ✗ (Rate limit)
5. Log Failure:
   {
     provider: "openrouter",
     model: "claude-sonnet-4.5",
     success: false,
     error: "Rate limit exceeded",
     was_fallback: false,
     attempt_number: 1
   }
   ↓
6. Model Router: Try Gemini 3 Flash
   ↓
7. OpenRouter API Call
   ↓ FAILED ✗ (Quota exceeded)
8. Log Failure:
   {
     provider: "openrouter",
     model: "gemini-3-flash",
     success: false,
     error: "Quota exceeded",
     was_fallback: true,
     attempt_number: 2
   }
   ↓
9. Model Router: Try Hugging Face Fallback
   ↓
10. Hugging Face API Call (Meditron-7B)
    ↓ SUCCESS ✓
11. Log Success:
    {
      provider: "huggingface",
      model: "meditron-7b",
      feature: "chat",
      success: true,
      tokens_used: 200,
      was_fallback: true,
      attempt_number: 3,
      response_time_ms: 1200
    }
    ↓
12. Send Admin Notification:
    "Fell back to Hugging Face for chat feature"
    ↓
13. Return Response to User
```

## Admin Dashboard Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN DASHBOARD REQUEST                       │
│              GET /api/admin/model-usage/stats                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MODEL USAGE LOGGER                            │
│                                                                   │
│  Query model_usage_logs table:                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ SELECT * FROM model_usage_logs                           │  │
│  │ WHERE timestamp >= start_date                            │  │
│  │ AND timestamp <= end_date                                │  │
│  │ ORDER BY timestamp DESC                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                    │
│                             ▼                                    │
│  Aggregate Statistics:                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ • Total calls: COUNT(*)                                  │  │
│  │ • Success rate: COUNT(success=true) / COUNT(*)           │  │
│  │ • Fallback rate: COUNT(was_fallback=true) / COUNT(*)     │  │
│  │ • Total tokens: SUM(tokens_used)                         │  │
│  │                                                           │  │
│  │ Group by provider:                                       │  │
│  │   openrouter: {calls, tokens, failures}                  │  │
│  │   huggingface: {calls, tokens, failures}                 │  │
│  │                                                           │  │
│  │ Group by feature:                                        │  │
│  │   chat: {calls, tokens, failures}                        │  │
│  │   flashcard: {calls, tokens, failures}                   │  │
│  │                                                           │  │
│  │ Group by model:                                          │  │
│  │   claude-sonnet-4.5: {calls, tokens, failures}           │  │
│  │   meditron-7b: {calls, tokens, failures}                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RETURN JSON RESPONSE                          │
│  {                                                               │
│    "total_calls": 1250,                                         │
│    "success_rate": 94.4,                                        │
│    "fallback_rate": 3.6,                                        │
│    "by_provider": {...},                                        │
│    "by_feature": {...},                                         │
│    "by_model": {...}                                            │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Cost Optimization Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    COST ANALYSIS                                 │
│                                                                   │
│  Query model_usage_logs for last 30 days:                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ OpenRouter (Paid):                                       │  │
│  │   • Claude Sonnet: 800 calls, 350K tokens               │  │
│  │   • Cost: 350K * $3/1M = $1.05                          │  │
│  │                                                           │  │
│  │   • Gemini Flash: 300 calls, 70K tokens                 │  │
│  │   • Cost: 70K * $0.50/1M = $0.035                       │  │
│  │                                                           │  │
│  │ Hugging Face (Free/Cheap):                              │  │
│  │   • Meditron-7B: 150 calls, 30K tokens                  │  │
│  │   • Cost: FREE (under 30K requests/month)               │  │
│  │                                                           │  │
│  │ Total Cost: $1.085                                       │  │
│  │ Savings from Fallback: $0.15 (would have been $1.235)  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Recommendations:                                                │
│  • Increase Gemini usage (cheaper)                              │
│  • Hugging Face saved 12% of costs                              │
│  • Consider upgrading HF plan for more free requests            │
└─────────────────────────────────────────────────────────────────┘
```

This architecture ensures zero downtime, cost optimization, and complete visibility into model usage!
