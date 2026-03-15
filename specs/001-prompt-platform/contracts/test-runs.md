# API Contracts: Test Runs & Execution

**Version**: 1.0  
**Base URL**: `/api/workspaces/[workspaceId]/prompts/[promptId]/test-runs`  
**Authentication**: Google OAuth (session required)

---

## POST /

Execute test run against selected LLM providers.

**Request Body**:

```json
{
  "prompt_version_id": "uuid",
  "provider_ids": ["openai-1", "anthropic-1", "google-1"],
  "input_data": {
    "email_subject": "Best deal ever!",
    "email_body": "Click here to claim..."
  },
  "parameters": {
    "temperature": 0.7,
    "max_tokens": 200,
    "top_p": 0.9
  }
}
```

**Validation**:

- `prompt_version_id` must exist and belong to this prompt
- `provider_ids` must be configured in workspace
- `provider_ids` length: 1-5 providers per run
- `parameters` optional, override version defaults

**Async Execution**:
Test execution is async. Response returns immediately with `status: 'queued'`. Results stream back via:

1. **Polling**: Client polls `/test-runs/{id}` until `status: 'completed'`
2. **WebSocket** (future): Real-time status updates

**Response** (202 Accepted):

```json
{
  "id": "uuid",
  "status": "queued",
  "execution": {
    "started_at": null,
    "completed_at": null
  },
  "results": [],
  "ratings": {},
  "created_at": "2026-01-26T10:20:00Z",
  "message": "Test execution queued. Poll /test-runs/{id} for updates."
}
```

**Status Codes**:

- `202 Accepted` — Execution queued
- `400 Bad Request` — Invalid request
- `401 Unauthorized` — Missing auth
- `403 Forbidden` — Workspace access denied
- `409 Conflict` — Quota exceeded
- `503 Service Unavailable` — Provider unavailable

---

## GET /

List test runs for prompt.

**Query Parameters**:

- `version_id`: Filter by specific version (optional)
- `status`: `queued | running | completed | failed` (optional)
- `sort`: `created_at` (default) | `status`
- `order`: `asc` | `desc` (default: `desc`)
- `limit`: number (default: 50)
- `offset`: number (default: 0)

**Response**:

```json
{
  "data": [
    {
      "id": "uuid",
      "prompt_version_id": "uuid",
      "status": "completed",
      "execution": {
        "started_at": "2026-01-26T10:20:05Z",
        "completed_at": "2026-01-26T10:20:15Z",
        "duration_ms": 10000
      },
      "results": [
        {
          "provider_id": "openai-1",
          "status": "success",
          "normalized": {
            "tokens_total": 150,
            "latency_ms": 1200,
            "cost_usd": 0.0018
          },
          "rating": { "score": 4, "notes": "Good output" }
        }
      ],
      "created_at": "2026-01-26T10:20:00Z"
    }
  ],
  "pagination": { "total": 15, "limit": 50, "offset": 0 }
}
```

**Status Codes**:

- `200 OK` — Success
- `404 Not Found` — Prompt not found

---

## GET /:testRunId

Get single test run details.

**Response**:

```json
{
  "id": "uuid",
  "prompt_id": "uuid",
  "prompt_version_id": "uuid",
  "workspace_id": "uuid",
  "status": "completed",
  "execution": {
    "status": "completed",
    "started_at": "2026-01-26T10:20:05Z",
    "completed_at": "2026-01-26T10:20:15Z",
    "duration_ms": 10000
  },
  "inputs": {
    "provider_ids": ["openai-1", "anthropic-1"],
    "input_data": { "email_subject": "...", "email_body": "..." },
    "parameters": { "temperature": 0.7, "max_tokens": 200 }
  },
  "results": [
    {
      "provider_id": "openai-1",
      "status": "success",
      "raw_response": {
        "model": "gpt-4-turbo",
        "content": "This is a phishing email...",
        "stop_reason": "stop",
        "usage": {
          "prompt_tokens": 150,
          "completion_tokens": 45,
          "total_tokens": 195
        }
      },
      "normalized": {
        "tokens_total": 195,
        "latency_ms": 1200,
        "cost_usd": 0.00195,
        "character_count": 280
      },
      "executed_at": "2026-01-26T10:20:08Z"
    },
    {
      "provider_id": "anthropic-1",
      "status": "success",
      "raw_response": {
        "model": "claude-3-opus",
        "content": "Likely phishing attempt based on...",
        "stop_reason": "stop"
      },
      "normalized": {
        "tokens_total": 180,
        "latency_ms": 950,
        "cost_usd": 0.0018,
        "character_count": 315
      },
      "executed_at": "2026-01-26T10:20:07Z"
    }
  ],
  "ratings": {
    "openai-1": {
      "score": 4,
      "notes": "Accurate classification",
      "rated_at": "2026-01-26T10:25:00Z"
    },
    "anthropic-1": {
      "score": 5,
      "notes": "Most detailed explanation",
      "rated_at": "2026-01-26T10:25:00Z"
    }
  },
  "created_at": "2026-01-26T10:20:00Z"
}
```

**Status Codes**:

- `200 OK` — Success
- `404 Not Found` — Test run not found
- `403 Forbidden` — Workspace access denied

---

## POST /:testRunId/ratings

Add or update ratings for test run results.

**Request Body**:

```json
{
  "provider_id": "openai-1",
  "score": 4,
  "notes": "Accurate but verbose"
}
```

**Validation**:

- `score` required, 1-5
- `notes` optional, max 500 chars
- `provider_id` must have result in this test run

**Response**:

```json
{
  "id": "uuid",
  "ratings": {
    "openai-1": {
      "score": 4,
      "notes": "Accurate but verbose",
      "rated_at": "2026-01-26T10:25:00Z"
    }
  }
}
```

**Status Codes**:

- `200 OK` — Success
- `400 Bad Request` — Invalid score or provider
- `404 Not Found` — Test run not found
- `409 Conflict` — Test run still executing

---

## Provider-Specific Response Structures

### OpenAI (GPT-4, GPT-3.5)

**Raw Response**:

```json
{
  "model": "gpt-4-turbo",
  "content": "Response text...",
  "stop_reason": "stop",
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 45,
    "total_tokens": 195
  }
}
```

**Cost Calculation**:

- Tokens × provider rate (stored in config)
- Example: gpt-4-turbo = $0.01/1K input, $0.03/1K output

### Anthropic (Claude)

**Raw Response**:

```json
{
  "model": "claude-3-opus",
  "content": "Response text...",
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 150,
    "output_tokens": 45
  }
}
```

**Cost Calculation**:

- Tokens × provider rate
- Example: claude-3-opus = $0.015/1K input, $0.075/1K output

### Google (Gemini)

**Raw Response**:

```json
{
  "model": "gemini-1.5-pro",
  "content": "Response text...",
  "finish_reason": "stop",
  "usage_metadata": {
    "prompt_token_count": 150,
    "candidates_token_count": 45
  }
}
```

**Cost Calculation**:

- Tokens × provider rate
- Example: gemini-1.5-pro = $0.005/1K input, $0.015/1K output

---

## Error Handling

**Timeout (>60s)**:

```json
{
  "provider_id": "openai-1",
  "status": "timeout",
  "error": {
    "code": "TIMEOUT",
    "message": "Request exceeded 60s timeout"
  },
  "executed_at": "2026-01-26T10:21:00Z"
}
```

**Invalid API Key**:

```json
{
  "provider_id": "anthropic-1",
  "status": "error",
  "error": {
    "code": "INVALID_API_KEY",
    "message": "Invalid authentication credentials"
  }
}
```

**Rate Limit**:

```json
{
  "provider_id": "google-1",
  "status": "rate_limited",
  "error": {
    "code": "RATE_LIMIT",
    "message": "Rate limit exceeded. Retry after 60 seconds."
  }
}
```

---

## Performance Guarantees

- **Latency**: Individual provider response time varies (typically 500ms-5s)
- **Timeout**: 60 seconds per provider; failed providers don't block others (parallel execution)
- **Queueing**: Max 100 concurrent executions; additional queued
- **Cost Tracking**: Normalized cost_usd field computed immediately after response
- **Storage**: TestRun results persisted to IndexedDB within 5 seconds of completion
