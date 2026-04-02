export interface Prompt {
  id: string;
  workspace_id: string;
  title: string;
  description?: string;
  content: string; // Mutable working draft — auto-saved, not versioned
  current_version_id: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  is_favorite: boolean;
  status: 'draft' | 'active' | 'archived';
  metadata: {
    version_count: number;
  };
}
