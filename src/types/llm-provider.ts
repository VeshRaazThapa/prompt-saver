export type LLMProviderName = 'openai' | 'anthropic' | 'google' | 'custom';

export interface LLMProvider {
  id: string; // UUID
  workspace_id: string; // FK: Workspace.id (scoping)
  provider_name: LLMProviderName;

  // Credentials (encrypted at rest)
  credentials: {
    api_key: string; // ENCRYPTED
    org_id?: string; // Optional (OpenAI org)
    region?: string; // Optional (Google region)
  };

  // Configuration
  config: {
    model: string; // "gpt-4-turbo", "claude-3-opus", etc.
    base_url?: string; // Custom endpoint (for self-hosted)
    timeout_ms: number; // Timeout for this provider
  };

  // Metadata
  created_at: string; // ISO8601 timestamp
  updated_at: string; // ISO8601 timestamp
  status: 'active' | 'disabled' | 'error';
  error?: string; // Last error message (e.g., "Invalid API key")
  last_tested: string; // ISO8601 of last successful call

  // Usage tracking
  stats: {
    total_calls: number;
    successful_calls: number;
    failed_calls: number;
    total_tokens: number;
    estimated_cost_usd: number;
  };
}
