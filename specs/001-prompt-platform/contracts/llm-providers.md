# API Contracts: LLM Providers

**Version**: 1.0  
**Base URL**: `/api/workspaces/[workspaceId]/providers`  
**Authentication**: Google OAuth (session required)  
**Security**: API keys encrypted at rest, never logged or exposed

---

## GET /

List configured LLM providers for workspace.

**Response**:

```json
{
  "data": [
    {
      "id": "uuid",
      "provider_name": "openai",
      "config": {
        "model": "gpt-4-turbo",
        "timeout_ms": 60000
      },
      "status": "active",
      "last_tested": "2026-01-26T10:15:00Z",
      "stats": {
        "total_calls": 42,
        "successful_calls": 40,
        "failed_calls": 2,
        "total_tokens": 15420,
        "estimated_cost_usd": 0.18
      },
      "created_at": "2026-01-26T10:00:00Z",
      "updated_at": "2026-01-26T10:15:00Z"
    },
    {
      "id": "uuid",
      "provider_name": "anthropic",
      "config": {
        "model": "claude-3-opus",
        "timeout_ms": 60000
      },
      "status": "active",
      "last_tested": "2026-01-26T10:10:00Z",
      "stats": {
        "total_calls": 28,
        "successful_calls": 28,
        "failed_calls": 0,
        "total_tokens": 8900,
        "estimated_cost_usd": 0.22
      }
    }
  ],
  "supported_providers": ["openai", "anthropic", "google", "custom"]
}
```

**Status Codes**:

- `200 OK` — Success
- `401 Unauthorized` — Missing auth
- `403 Forbidden` — Workspace access denied

---

## POST /

Add new LLM provider.

**Request Body**:

```json
{
  "provider_name": "openai",
  "credentials": {
    "api_key": "sk-...",
    "org_id": "org-..."
  },
  "config": {
    "model": "gpt-4-turbo",
    "timeout_ms": 60000
  }
}
```

**Provider-Specific Credentials**:

### OpenAI

```json
{
  "provider_name": "openai",
  "credentials": {
    "api_key": "sk-...",
    "org_id": "org-..."
  },
  "config": {
    "model": "gpt-4-turbo",
    "timeout_ms": 60000
  }
}
```

### Anthropic

```json
{
  "provider_name": "anthropic",
  "credentials": {
    "api_key": "sk-ant-..."
  },
  "config": {
    "model": "claude-3-opus",
    "timeout_ms": 60000
  }
}
```

### Google (Gemini)

```json
{
  "provider_name": "google",
  "credentials": {
    "api_key": "AIzaSy...",
    "region": "us-central1"
  },
  "config": {
    "model": "gemini-1.5-pro",
    "timeout_ms": 60000
  }
}
```

### Custom (Self-Hosted)

```json
{
  "provider_name": "custom",
  "credentials": {
    "api_key": "custom-key-...",
    "base_url": "https://your-llm-api.com/v1"
  },
  "config": {
    "model": "your-model",
    "timeout_ms": 60000
  }
}
```

**Validation**:

- `provider_name` required, one of: `openai`, `anthropic`, `google`, `custom`
- `api_key` required, max 500 chars
- `model` required, max 100 chars
- `timeout_ms` optional, 5000-300000 (default: 60000)
- Unique constraint: One provider per type per workspace (can't have 2x OpenAI)

**Credentials Security**:

- API key encrypted using Web Crypto API before storage
- Encryption key stored separately (session-based)
- Never logged or exposed in responses
- Rotation: Update endpoint to change key

**Response** (201 Created):

```json
{
  "id": "uuid",
  "provider_name": "openai",
  "status": "validating",
  "message": "Provider added. Validating credentials..."
}
```

**After Validation** (async):

- Status changes to `active` if credentials valid
- Status changes to `error` if credentials invalid
- Error message returned in GET response

**Status Codes**:

- `201 Created` — Provider added (validating)
- `400 Bad Request` — Invalid request
- `401 Unauthorized` — Missing auth
- `403 Forbidden` — Workspace access denied
- `409 Conflict` — Provider already configured

---

## PUT /:providerId

Update provider configuration.

**Request Body** (partial):

```json
{
  "config": {
    "model": "gpt-4-turbo-2024-04-09",
    "timeout_ms": 75000
  }
}
```

**Allowed Updates**:

- `config.model` — Change LLM model
- `config.timeout_ms` — Change timeout
- `credentials.api_key` — Rotate API key

**NOT Allowed**:

- `provider_name` — Cannot change provider type (delete and recreate instead)

**Response**:

```json
{
  "id": "uuid",
  "provider_name": "openai",
  "config": {
    "model": "gpt-4-turbo-2024-04-09",
    "timeout_ms": 75000
  },
  "updated_at": "2026-01-26T10:30:00Z"
}
```

**Status Codes**:

- `200 OK` — Success
- `400 Bad Request` — Invalid update
- `404 Not Found` — Provider not found
- `403 Forbidden` — Workspace access denied

---

## DELETE /:providerId

Remove LLM provider from workspace.

**Request Body** (optional):

```json
{
  "delete_credentials": true
}
```

**Behavior**:

- If any test runs reference this provider, they remain but show provider as "deleted"
- Status changes to `disabled` (not hard-deleted, for audit trail)
- With `delete_credentials: true`, securely erase API key

**Response**:

```json
{
  "id": "uuid",
  "status": "disabled",
  "message": "Provider removed from workspace. Credentials securely erased."
}
```

**Status Codes**:

- `200 OK` — Success
- `404 Not Found` — Provider not found
- `403 Forbidden` — Workspace access denied

---

## POST /:providerId/test

Test provider connection with sample request.

**Request Body** (optional):

```json
{
  "test_prompt": "Say 'Test successful' if you receive this message."
}
```

**Response**:

```json
{
  "provider_id": "uuid",
  "provider_name": "openai",
  "status": "success",
  "latency_ms": 1200,
  "model": "gpt-4-turbo",
  "message": "Connection successful",
  "test_result": {
    "input": "Say 'Test successful' if you receive this message.",
    "output": "Test successful",
    "tokens": 18,
    "cost_estimate": 0.00018
  }
}
```

**On Failure**:

```json
{
  "provider_id": "uuid",
  "provider_name": "openai",
  "status": "error",
  "error": {
    "code": "INVALID_API_KEY",
    "message": "Invalid authentication credentials for OpenAI API"
  }
}
```

**Status Codes**:

- `200 OK` — Connection successful
- `400 Bad Request` — Invalid provider
- `500 Internal Server Error` — Connection failed

---

## Error Scenarios

### Invalid API Key

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "API key is invalid or expired",
    "provider": "openai"
  }
}
```

### Rate Limit (Provider-side)

```json
{
  "error": {
    "code": "PROVIDER_RATE_LIMIT",
    "message": "OpenAI API rate limit exceeded",
    "retry_after_seconds": 60
  }
}
```

### Provider Unavailable

```json
{
  "error": {
    "code": "PROVIDER_UNAVAILABLE",
    "message": "Claude API is currently unavailable",
    "status": "503 Service Unavailable"
  }
}
```

---

## Security & Privacy

**API Key Handling**:

1. User submits API key via HTTPS
2. Key encrypted with workspace-scoped key (using Web Crypto)
3. Encrypted key stored in IndexedDB
4. Key never logged, never sent to third parties
5. Key only decrypted in-memory when making API calls

**Credential Rotation**:

```bash
# To rotate a key:
PUT /api/workspaces/{id}/providers/{id}
{
  "credentials": { "api_key": "new-key-..." }
}
```

**Audit Trail**:

- Provider add/remove/update logged with timestamp and user
- Failed authentication attempts logged (without key)
- Successful calls tracked with token count and cost

---

## Supported Providers & Models

### OpenAI

- `gpt-4-turbo`
- `gpt-4-turbo-2024-04-09`
- `gpt-3.5-turbo`

### Anthropic

- `claude-3-opus`
- `claude-3-sonnet`
- `claude-3-haiku`

### Google (Gemini)

- `gemini-1.5-pro`
- `gemini-1.5-flash`
- `gemini-1.0-pro`

### Custom/Self-Hosted

- Any endpoint supporting text-in-text-out API
- Must support OpenAI-compatible format or custom adapter

---

## Provider Comparison

| Feature        | OpenAI        | Anthropic       | Google          | Custom   |
| -------------- | ------------- | --------------- | --------------- | -------- |
| Authentication | API Key       | API Key         | API Key         | Custom   |
| Streaming      | Yes           | Yes             | Yes             | Optional |
| Cost           | $0.01-0.03/1K | $0.015-0.075/1K | $0.005-0.015/1K | Custom   |
| Rate Limits    | 3.5K-100K/min | Based on tier   | 60/min free     | Custom   |
| Latency (p95)  | 800-2000ms    | 600-1500ms      | 1000-2500ms     | Variable |
