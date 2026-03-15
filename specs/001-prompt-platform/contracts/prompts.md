# API Contracts: Prompts Endpoints

**Version**: 1.0  
**Base URL**: `/api/workspaces/[workspaceId]`  
**Authentication**: Google OAuth (session required)  
**Response Format**: JSON

---

## GET /prompts

List all prompts in workspace.

**Query Parameters**:

- `sort`: `created_at` | `updated_at` | `title` (default: `updated_at`)
- `order`: `asc` | `desc` (default: `desc`)
- `tag`: string (filter by tag)
- `status`: `draft` | `active` | `archived` (filter by status)
- `favorites_only`: boolean (default: false)
- `pinned_only`: boolean (default: false)
- `limit`: number (default: 50, max: 500)
- `offset`: number (default: 0)

**Response**:

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Email Classifier",
      "description": "Classifies emails into categories",
      "current_version_id": "uuid",
      "created_at": "2026-01-26T10:00:00Z",
      "updated_at": "2026-01-26T15:30:00Z",
      "tags": ["classification", "email"],
      "is_favorite": true,
      "is_pinned": false,
      "status": "active",
      "metadata": {
        "version_count": 3,
        "test_run_count": 12,
        "last_tested": "2026-01-26T15:00:00Z"
      }
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 50,
    "offset": 0,
    "has_more": false
  }
}
```

**Status Codes**:

- `200 OK` — Success
- `401 Unauthorized` — Missing auth
- `403 Forbidden` — Workspace access denied

---

## GET /prompts/:promptId

Get single prompt with metadata.

**Response**:

```json
{
  "id": "uuid",
  "title": "Email Classifier",
  "description": "Classifies emails into categories",
  "current_version_id": "uuid-v2",
  "created_by": "user-id",
  "created_at": "2026-01-26T10:00:00Z",
  "updated_at": "2026-01-26T15:30:00Z",
  "tags": ["classification", "email"],
  "is_favorite": true,
  "is_pinned": false,
  "status": "active",
  "metadata": {
    "version_count": 3,
    "test_run_count": 12,
    "last_tested": "2026-01-26T15:00:00Z"
  }
}
```

**Status Codes**:

- `200 OK` — Success
- `404 Not Found` — Prompt doesn't exist
- `403 Forbidden` — Workspace access denied

---

## POST /prompts

Create new prompt.

**Request Body**:

```json
{
  "title": "Email Classifier",
  "description": "Classifies emails into categories",
  "systemPrompt": "You are an email classification assistant...",
  "userPrompt": "Classify the following email...",
  "tags": ["classification", "email"],
  "temperature": 0.7,
  "max_tokens": 100
}
```

**Validation**:

- `title` required, max 200 chars
- `systemPrompt` optional, max 4000 chars
- `userPrompt` required, max 4000 chars
- `tags` optional, max 10 tags, each max 50 chars
- `temperature` optional, 0-2
- `max_tokens` optional, 1-4096

**Response**:

```json
{
  "id": "uuid",
  "title": "Email Classifier",
  "current_version_id": "uuid-v1",
  "created_at": "2026-01-26T10:00:00Z",
  "version_number": 1,
  "status": "active",
  "message": "Prompt created with version 1"
}
```

**Status Codes**:

- `201 Created` — Success
- `400 Bad Request` — Validation error
- `401 Unauthorized` — Missing auth
- `403 Forbidden` — Workspace access denied
- `409 Conflict` — Quota exceeded (free tier limit)

---

## PUT /prompts/:promptId

Update prompt metadata (NOT content). Content changes create new version.

**Request Body**:

```json
{
  "title": "Email Classifier v2",
  "description": "Updated description",
  "tags": ["classification", "email", "production"],
  "status": "active"
}
```

**Allowed Updates**: `title`, `description`, `tags`, `status`  
**NOT Allowed**: `content`, `current_version_id` (use versions endpoint)

**Response**:

```json
{
  "id": "uuid",
  "title": "Email Classifier v2",
  "updated_at": "2026-01-26T10:05:00Z"
}
```

**Status Codes**:

- `200 OK` — Success
- `400 Bad Request` — Attempt to modify immutable field
- `404 Not Found` — Prompt doesn't exist
- `403 Forbidden` — Workspace access denied

---

## DELETE /prompts/:promptId

Soft-delete prompt (moves to archive).

**Response**:

```json
{
  "id": "uuid",
  "status": "archived",
  "message": "Prompt archived. Can be restored within 30 days."
}
```

**Status Codes**:

- `200 OK` — Success
- `404 Not Found` — Prompt doesn't exist
- `403 Forbidden` — Workspace access denied

---

## POST /prompts/:promptId/favorite

Toggle favorite status.

**Request Body** (optional):

```json
{
  "is_favorite": true
}
```

**Response**:

```json
{
  "id": "uuid",
  "is_favorite": true
}
```

**Status Codes**:

- `200 OK` — Success
- `404 Not Found` — Prompt doesn't exist

---

## POST /prompts/:promptId/pin

Toggle pinned status.

**Request Body** (optional):

```json
{
  "is_pinned": true
}
```

**Response**:

```json
{
  "id": "uuid",
  "is_pinned": true
}
```

**Status Codes**:

- `200 OK` — Success
- `404 Not Found` — Prompt doesn't exist

---

## POST /prompts/:promptId/versions

Create new version (new content → auto-create version).

**Request Body**:

```json
{
  "systemPrompt": "Updated system prompt...",
  "userPrompt": "Updated user prompt...",
  "temperature": 0.8,
  "max_tokens": 150,
  "summary": "Improved clarity and added examples"
}
```

**Validation**:

- At least one of `systemPrompt` or `userPrompt` must differ from current
- `summary` optional, max 500 chars

**Response**:

```json
{
  "id": "uuid",
  "version_number": 2,
  "prompt_id": "uuid",
  "created_at": "2026-01-26T10:10:00Z",
  "previous_version_id": "uuid-v1"
}
```

**Constraints**:

- **Atomic**: Both version creation and prompt update succeed or both fail
- **Latency**: Must complete <100ms (IndexedDB transaction)
- **Immutable**: Once created, version cannot be edited

**Status Codes**:

- `201 Created` — Success
- `400 Bad Request` — No content changes
- `404 Not Found` — Prompt doesn't exist
- `409 Conflict` — Concurrent version creation (retry)

---

## GET /prompts/:promptId/versions

List all versions of a prompt.

**Query Parameters**:

- `limit`: number (default: 50)
- `offset`: number (default: 0)

**Response**:

```json
{
  "data": [
    {
      "id": "uuid",
      "version_number": 2,
      "created_at": "2026-01-26T10:10:00Z",
      "created_by": "user-id",
      "summary": "Improved clarity and added examples",
      "metadata": {
        "tags": ["v2-production"]
      }
    },
    {
      "id": "uuid",
      "version_number": 1,
      "created_at": "2026-01-26T10:00:00Z",
      "created_by": "user-id",
      "summary": null
    }
  ],
  "pagination": { "total": 2, "limit": 50, "offset": 0 }
}
```

**Status Codes**:

- `200 OK` — Success
- `404 Not Found` — Prompt doesn't exist

---

## GET /prompts/:promptId/versions/:versionId/diff

Get diff between two versions.

**Query Parameters**:

- `compare_to`: versionId (default: previous version)

**Response**:

```json
{
  "from_version": 1,
  "to_version": 2,
  "systemPrompt": {
    "added": ["new system instruction"],
    "removed": ["old system instruction"],
    "unchanged": true
  },
  "userPrompt": {
    "diff": [
      { "type": "add", "text": "Added clarification" },
      { "type": "remove", "text": "Removed outdated example" }
    ]
  },
  "parameters": {
    "temperature": { "from": 0.7, "to": 0.8 },
    "max_tokens": { "from": 100, "to": 150 }
  }
}
```

**Status Codes**:

- `200 OK` — Success
- `404 Not Found` — Version doesn't exist

---

## Error Responses

All endpoints return standard error format:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Descriptive error message",
    "details": { "field": "title", "reason": "required" }
  }
}
```

**Common Error Codes**:

- `INVALID_REQUEST` — 400 Bad Request
- `UNAUTHORIZED` — 401 Unauthorized
- `FORBIDDEN` — 403 Forbidden
- `NOT_FOUND` — 404 Not Found
- `CONFLICT` — 409 Conflict
- `QUOTA_EXCEEDED` — 429 Quota Limit
- `INTERNAL_ERROR` — 500 Server Error
