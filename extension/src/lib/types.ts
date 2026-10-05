export interface ExtPrompt {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  updated_at: string;
  content: string;
  is_favorite: boolean;
}
