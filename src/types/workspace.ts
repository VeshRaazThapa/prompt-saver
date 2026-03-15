export interface Workspace {
  id: string; // UUID
  user_id: string; // FK: User.id
  name: string; // "My Project", "LLM Testing", etc.
  description?: string; // Optional workspace description
  created_at: string; // ISO8601 timestamp
  updated_at: string; // ISO8601 timestamp
  settings: {
    defaultProvider?: string; // Default LLM provider for quick testing
    theme?: 'light' | 'dark'; // UI preference
  };
  metadata: {
    promptCount: number; // Denormalized for quick stats
    lastActivity: string; // ISO8601 of last action
  };
}
