export interface Prompt {
  id: string; // UUID
  workspace_id: string; // FK: Workspace.id (scoping)
  title: string; // "Email classifier", "Code reviewer", etc.
  description?: string; // Markdown-formatted description
  current_version_id: string; // FK: PromptVersion.id (always latest)
  created_by: string; // FK: User.id
  created_at: string; // ISO8601 timestamp
  updated_at: string; // ISO8601 timestamp (updates when new version created)
  tags: string[]; // ["classification", "email", "production"]
  is_favorite: boolean; // User favorited this prompt
  is_pinned: boolean; // User pinned to top of library
  status: 'draft' | 'active' | 'archived'; // Lifecycle state
  metadata: {
    version_count: number; // Total versions
    test_run_count: number; // Total test runs against all versions
    last_tested: string; // ISO8601 of most recent test run
  };
}
