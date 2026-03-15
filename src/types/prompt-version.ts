export interface PromptVersion {
  id: string; // UUID
  prompt_id: string; // FK: Prompt.id
  version_number: number; // 1, 2, 3, ... (auto-increment)
  content: {
    systemPrompt?: string; // System message (optional)
    userPrompt: string; // Main prompt content
    temperature?: number; // LLM parameter (0-2)
    max_tokens?: number; // LLM parameter
    top_p?: number; // LLM parameter
  };
  metadata: {
    summary?: string; // Version summary ("Improved clarity", "Fixed typo")
    tags: string[]; // Version-specific tags
  };
  created_by: string; // FK: User.id
  created_at: string; // ISO8601 timestamp (immutable)
  previous_version_id?: string; // FK: PromptVersion.id (for diff tracking)
}
