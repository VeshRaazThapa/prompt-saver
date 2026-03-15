export interface TestResult {
  provider_id: string; // FK: LLMProvider.id
  status: 'success' | 'timeout' | 'error' | 'rate_limited';

  // Raw provider response (stored as-is for audits)
  raw_response?: {
    model: string; // e.g., "gpt-4-turbo"
    content: string; // Full response text
    stop_reason: string; // "stop", "length", etc.
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };

  // Normalized fields (computed for analytics)
  normalized: {
    tokens_total: number;
    latency_ms: number;
    cost_usd?: number; // Estimated cost
    character_count: number;
  };

  // Error info (if failed)
  error?: {
    code: string; // "timeout", "invalid_api_key", "rate_limit", etc.
    message: string;
  };

  executed_at: string; // ISO8601 timestamp
}

export interface Rating {
  score: 1 | 2 | 3 | 4 | 5; // 1-5 stars
  notes?: string; // User feedback
  rated_at: string; // ISO8601
}

export interface TestRun {
  id: string; // UUID
  prompt_id: string; // FK: Prompt.id
  prompt_version_id: string; // FK: PromptVersion.id (immutable reference)
  workspace_id: string; // FK: Workspace.id (scoping)
  created_by: string; // FK: User.id
  created_at: string; // ISO8601 timestamp

  // Execution metadata
  execution: {
    status: 'queued' | 'running' | 'completed' | 'failed';
    started_at?: string; // When execution began
    completed_at?: string; // When execution ended
    duration_ms?: number; // Total execution time
  };

  // Test inputs
  inputs: {
    provider_ids: string[]; // Providers to test against
    input_data?: Record<string, unknown>; // User-provided test input
    parameters: {
      temperature?: number;
      max_tokens?: number;
      top_p?: number;
    };
  };

  // Test results (one per provider)
  results: TestResult[];

  // User ratings/feedback
  ratings: {
    [provider_id: string]: Rating;
  };
}
