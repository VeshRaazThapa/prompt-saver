export interface PromptVersion {
  id: string;
  prompt_id: string;
  version_number: number;
  content: string; // Immutable plain text snapshot
  result?: string; // LLM output for this prompt version (markdown)
  change_summary?: string;
  created_at: string;
  previous_version_id?: string;
}
