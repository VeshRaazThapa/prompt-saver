export interface PromptVersion {
  id: string;
  prompt_id: string;
  version_number: number;
  content: string; // Immutable plain text snapshot
  change_summary?: string;
  created_at: string;
  previous_version_id?: string;
}
